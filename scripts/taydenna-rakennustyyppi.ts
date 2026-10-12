import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENNUSTYYPPI OLEMASSA OLEVISTA KUVAUKSISTA (D-274).
 *
 * `inferBuildingType` on ollut olemassa koko ajan, mutta se ajetaan
 * vain tuonnin yhteydessa. Rivit jotka tuotiin ennen kuin niilla oli
 * kunnon kuvaus jaivat ilman tyyppia — ja juuri niiden kuvaukset
 * paranivat 11.-12.10.2026 (D-268...D-273).
 *
 * MIKSI TAMA ON TARKEA: kartan "Kohdetyyppi"-suodatin lukee
 * `property_type`-saraketta. Tyypiton hanke katoaa nakymasta heti kun
 * kayttaja valitsee tyypin — asiakas ei tieda etta se on olemassa.
 * Asiakas pyysi juuri tata suodatinta 12.10.2026.
 *
 * EI YLIKIRJOITA. Vain tyhjat taytetaan; kasin annettu tai lahteesta
 * tullut tyyppi jaa koskematta.
 *
 *   npx tsx scripts/taydenna-rakennustyyppi.ts
 *   npx tsx scripts/taydenna-rakennustyyppi.ts --apply
 */

async function main() {
  const apply = process.argv.includes("--apply")
  /*
   * RUNKO ON POIS PAALTA OLETUKSENA (D-274).
   *
   * `inferBuildingType` lukee otsikon ja rungon ensimmaiset 700 merkkia.
   * Yritystiedotteelle se toimii, mutta kaavaselostuksen alku on
   * aluekuvausta: mitattu 12.10.2026 etta runko antoi tyypin "Kirjasto"
   * aurinkovoima-osayleiskaavalle, "Silta" Teknobulevardin tonteille ja
   * "Hotelli" Siikajarvi Pohjoiselle. Otsikko on lyhyt ja kertoo mista
   * on kyse.
   */
  const myosRunko = process.argv.includes("--runko")
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, property_type, additional_info, status, is_public, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 500) break
  }

  const kohteet = rivit.filter((r) => !r.property_type)
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hankkeita ${rivit.length}, ilman tyyppia ${kohteet.length}\n`)

  const jakauma = new Map<string, number>()
  const naytteet = new Map<string, string[]>()
  let tehty = 0

  for (const r of kohteet) {
    const tyyppi = inferBuildingType(
      String(r.name ?? ""),
      myosRunko ? String(r.additional_info ?? "") || null : null
    )
    if (!tyyppi) continue

    tehty += 1
    jakauma.set(tyyppi, (jakauma.get(tyyppi) ?? 0) + 1)
    const lista = naytteet.get(tyyppi) ?? []
    if (lista.length < 3) {
      lista.push(String(r.name ?? "").slice(0, 56))
      naytteet.set(tyyppi, lista)
    }

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        property_type: tyyppi,
        metadata: {
          ...(r.metadata ?? {}),
          property_type_source: "inferBuildingType",
          property_type_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
  }

  console.log("tyypit ja naytteet:")
  for (const [tyyppi, n] of [...jakauma.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`\n  ${String(n).padStart(4)}  ${tyyppi}`)
    for (const nimi of naytteet.get(tyyppi) ?? []) console.log(`        ${nimi}`)
  }

  const nakyvat = rivit.filter((r) => r.status === "active" && r.is_public !== false)
  const nytTyyppi = nakyvat.filter((r) => r.property_type).length
  const lisays = kohteet.filter(
    (r) =>
      r.status === "active" &&
      r.is_public !== false &&
      inferBuildingType(
        String(r.name ?? ""),
        myosRunko ? String(r.additional_info ?? "") || null : null
      )
  ).length
  console.log(
    `\ntaydennettavia ${tehty} (kaikki tilat), asiakkaalle nakyvia niista ${lisays}`
  )
  console.log(
    `  kattavuus nakyvissa: ${nytTyyppi} / ${nakyvat.length} (${((100 * nytTyyppi) / nakyvat.length).toFixed(1)} %) -> ${nytTyyppi + lisays} (${((100 * (nytTyyppi + lisays)) / nakyvat.length).toFixed(1)} %)`
  )
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
