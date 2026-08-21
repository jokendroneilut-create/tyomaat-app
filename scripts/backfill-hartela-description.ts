import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HARTELAN ASUINALUEIDEN KUVAUS JA TYYPPI TAKAUTUVASTI.
 *
 * Kaksi vikaa (D-099):
 *   1. kuvaus luettiin sivun alusta, joka markkinoi KAUPUNKIA eika
 *      hanketta - ja alkoi selainkehotuksella (15/15)
 *   2. rakennustyyppi paateltiin samasta tekstista, jolloin kaupungin
 *      palveluluettelo teki asuinhankkeesta paivakodin (6/15)
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { hartelaDescription, residentialTypeOnly } = await import(
    "../lib/agent/fetchHartelaAreasSource"
  )
  const { inferBuildingType } = await import("../lib/agent/buildingType")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, metadata")
      .eq("metadata->>source_name", "hartela_asuinalueet")
      .range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hartela_asuinalueet-ehdokkaita: ${rivit.length}\n`)

  let kuvausMuuttuu = 0, tyyppiMuuttuu = 0, tyyppiPoistuu = 0

  for (const r of rivit) {
    const meta: any = r.metadata ?? {}
    const vanhaKuvaus = String(meta.description ?? "")
    if (!vanhaKuvaus) continue

    const uusiKuvaus = hartelaDescription(vanhaKuvaus)
    const vanhaTyyppi = meta.building_type ?? null
    const uusiTyyppi = residentialTypeOnly(
      inferBuildingType(String(r.title ?? ""), uusiKuvaus)
    )

    const kMuuttuu = uusiKuvaus !== vanhaKuvaus
    const tMuuttuu = (uusiTyyppi ?? null) !== (vanhaTyyppi ?? null)
    if (!kMuuttuu && !tMuuttuu) continue

    if (kMuuttuu) kuvausMuuttuu++
    if (tMuuttuu) {
      tyyppiMuuttuu++
      if (!uusiTyyppi) tyyppiPoistuu++
    }

    console.log(`  ${String(r.title).slice(0, 40).padEnd(42)} [${r.status}]`)
    if (kMuuttuu) {
      console.log(`     kuvaus ${String(vanhaKuvaus.length).padStart(4)} -> ${String(uusiKuvaus.length).padStart(4)}`)
      console.log(`       oli:  ${vanhaKuvaus.slice(0, 88)}`)
      console.log(`       nyt:  ${uusiKuvaus.slice(0, 88)}`)
    }
    if (tMuuttuu) console.log(`     tyyppi ${String(vanhaTyyppi ?? "-")} -> ${uusiTyyppi ?? "-"}`)
    console.log("")

    if (!APPLY) continue

    const uusiMeta: any = { ...meta, description: uusiKuvaus }
    if (uusiTyyppi) uusiMeta.building_type = uusiTyyppi
    else delete uusiMeta.building_type

    await supabase.from("potential_projects").update({ metadata: uusiMeta }).eq("id", r.id)
  }

  console.log(`kuvaus korjataan:        ${kuvausMuuttuu}`)
  console.log(`tyyppi korjataan:        ${tyyppiMuuttuu}`)
  console.log(`  niista poistetaan:     ${tyyppiPoistuu}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
