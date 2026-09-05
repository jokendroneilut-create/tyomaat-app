import { readFileSync } from "node:fs"

/*
 * MITTAUS: LÖYTÄISIKÖ TALOYHTIÖN NIMI DUPLIKAATTEJA?
 *
 * Duplikaattiskannaus vertailee vain saman kaupungin, lupanumeron tai
 * kiinteistötunnuksen hankkeita, ja laatuportti vaatii lisäksi joko
 * vahvan tunnisteen tai nimitodisteen + saman kaupungin.
 *
 * Taloyhtiön nimi on rekisteröity ja yksilöivä. Tämä mittaa, montako
 * paria jakaa saman taloyhtiöavaimen ja kuinka moni niistä jää
 * nykyisellä säännöllä löytymättä.
 *
 *   npx tsx scripts/measure-housing-duplicates.ts
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { housingCompanyKey } = await import("../lib/projects/housingCompanyKey")
  const { calculateMatch, haveHardVeto } = await import("../lib/agent/projectMatcher")
  const { passesDuplicateQualityBar } = await import("../lib/agent/duplicates/qualityBar")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select(
        "id,name,city,region,location,phase,completed_at,status,developer,property_type,additional_info,metadata"
      )
      .eq("is_public", true)
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /* Jo kirjatut parit eivat ole loyto. */
  const jo = new Set<string>()
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("project_duplicate_candidates")
      .select("project_id_a,project_id_b")
      .range(f, f + 999)
    if (error) throw error
    for (const p of data ?? []) jo.add(`${(p as any).project_id_a}:${(p as any).project_id_b}`)
    if (!data || data.length < 1000) break
  }

  const ryhmat = new Map<string, any[]>()
  for (const r of rivit) {
    const md: any = r.metadata ?? {}
    const avain = housingCompanyKey(String(r.name ?? ""), r.additional_info ?? md.description ?? null)
    if (!avain) continue
    const lista = ryhmat.get(avain)
    if (lista) lista.push(r)
    else ryhmat.set(avain, [r])
  }

  const monta = [...ryhmat.entries()].filter(([, v]) => v.length > 1)
  console.log(`${rivit.length} julkista hanketta, ${ryhmat.size} taloyhtioavainta`)
  console.log(`avaimia joilla useampi hanke: ${monta.length}\n`)

  let pareja = 0
  let loytyisiJo = 0
  let uusia = 0

  for (const [avain, joukko] of monta) {
    for (let i = 0; i < joukko.length; i++) {
      for (let j = i + 1; j < joukko.length; j++) {
        const a = joukko[i]
        const b = joukko[j]
        pareja++

        const [idA, idB] = [a.id, b.id].sort()
        const kirjattu = jo.has(`${idA}:${idB}`)

        const match = calculateMatch(b as any, {
          name: a.name,
          sourceTitle: (a.metadata?.source_title as string | null) ?? null,
          city: a.city,
          region: a.region,
          location: a.location,
          permitNumber: a.metadata?.permit_number ?? null,
          propertyId: a.metadata?.property_id ?? null,
          developer: a.developer ?? a.metadata?.developer ?? null,
          buildingType: a.property_type ?? a.metadata?.building_type ?? null,
        })

        const nyt = !!match && passesDuplicateQualityBar({ ...match, reasons: match.reasons })

        /* Uusi reitti: sama taloyhtio on vahva tunniste. */
        const reasons = match ? [...match.reasons, "same_housing_company"] : ["same_housing_company"]
        const veto = !match && haveHardVeto(b as any, { name: a.name, city: a.city, description: null })
        const uudella = !veto && passesDuplicateQualityBar({ confidence: match?.confidence ?? 70, reasons } as any)

        if (kirjattu || nyt) loytyisiJo++
        else uusia++

        const tila = kirjattu ? "KIRJATTU" : nyt ? "loytyy  " : "UUSI    "
        console.log(`${tila} [${avain}] piste ${match ? match.confidence : "-"} -> uudella saannolla: ${uudella ? "LOYTYY" : "ei"}`)
        console.log(`   A ${String(a.city ?? "?").padEnd(12)} ${String(a.name ?? "").slice(0, 62)}`)
        console.log(`   B ${String(b.city ?? "?").padEnd(12)} ${String(b.name ?? "").slice(0, 62)}`)
        if (match) console.log(`   syyt: ${match.reasons.join(", ")}`)
        console.log("")
      }
    }
  }

  console.log(`\nYHTEENVETO: ${pareja} paria samalla taloyhtioavaimella`)
  console.log(`  jo kirjattu tai loytyy nykysaannolla: ${loytyisiJo}`)
  console.log(`  jaa nyt loytymatta:                   ${uusia}`)
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
