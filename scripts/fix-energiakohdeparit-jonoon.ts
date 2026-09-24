import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ENERGIAKOHDEPARIT DUPLIKAATTIJONOON (D-213).
 *
 * Laatuportti hyvaksyy nyt `same_energy_site` -tunnisteen, mutta
 * ajastettu skannaus on inkrementaalinen: se katsoo vain askettain
 * muuttuneita hankkeita, joten vanhat parit eivat loydy itsestaan.
 *
 * MIKSI EI TAYTTA SKANNAUSTA. Taysi ajo loytaisi myos kaikki MUUT parit
 * joita inkrementaalinen ei ole koskaan verrannut, enka ole lukenut
 * niita. Tama rajautuu niihin 32 pariin jotka olen lukenut lapi
 * (`scripts/measure-energiakohdeparit.ts`).
 *
 * Pari menee jonoon KATSELMOITAVAKSI (status pending). Hankkeita ei
 * yhdisteta - se on Johanneksen paatos TIC:issa.
 *
 *   npx tsx scripts/fix-energiakohdeparit-jonoon.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-energiakohdeparit-jonoon.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const ENERGIA = /tuulivoima|tuulipuisto|aurinkovoima|aurinkopuisto|energiavarast|akkuvarast/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const { passesDuplicateQualityBar } = await import("../lib/agent/duplicates/qualityBar")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const pr: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, region, location, developer, status, additional_info, metadata, property_type")
      .range(from, from + 999)
    if (error) throw error
    pr.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const aktiiviset = pr.filter((p) => p.status === "active")
  const energia = aktiiviset.filter(
    (p) => ENERGIA.test(String(p.name)) || ENERGIA.test(String(p.additional_info ?? ""))
  )

  const parit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("project_duplicate_candidates").select("project_id_a, project_id_b").range(from, from + 999)
    if (error) throw error
    parit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const jonossa = new Set(parit.map((x) => [x.project_id_a, x.project_id_b].sort().join("|")))

  console.log(`aktiivisia ${aktiiviset.length}, energiahankkeita ${energia.length}, jonossa jo ${jonossa.size} paria\n`)

  const lisattavat: any[] = []
  const nahdyt = new Set<string>()

  for (const a of energia) {
    for (const b of aktiiviset) {
      if (a.id === b.id) continue
      const [idA, idB] = [a.id, b.id].sort()
      const avain = `${idA}|${idB}`
      if (nahdyt.has(avain) || jonossa.has(avain)) continue

      const match = calculateMatch(b as any, {
        name: a.name,
        sourceTitle: a.metadata?.source_title ?? null,
        city: a.city, region: a.region, location: a.location,
        permitNumber: a.metadata?.permit_number ?? null,
        propertyId: a.metadata?.property_id ?? null,
        developer: a.developer ?? a.metadata?.developer ?? null,
        buildingType: a.property_type ?? a.metadata?.building_type ?? null,
        description: a.additional_info ?? a.metadata?.description ?? null,
      } as any)

      if (!match || !match.reasons.includes("same_energy_site")) continue
      if (!passesDuplicateQualityBar(match)) continue

      nahdyt.add(avain)
      lisattavat.push({
        rivi: { project_id_a: idA, project_id_b: idB, confidence: match.confidence, reasons: match.reasons },
        a, b, match,
      })
    }
  }

  for (const { a, b, match } of lisattavat.sort((x, y) => y.match.confidence - x.match.confidence)) {
    console.log(`${String(match.confidence).padStart(3)}  ${String(a.city ?? "-").padEnd(14)} ${String(a.name).slice(0, 50)}`)
    console.log(`                     ${String(b.name).slice(0, 50)}`)
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${lisattavat.length} paria jonoon ===`)
  if (!APPLY) return

  for (let i = 0; i < lisattavat.length; i += 50) {
    const { error } = await db
      .from("project_duplicate_candidates")
      .upsert(lisattavat.slice(i, i + 50).map((x) => x.rivi), {
        onConflict: "project_id_a,project_id_b",
        ignoreDuplicates: true,
      })
    if (error) throw error
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
