import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SAMA TUULI-/AURINKOKOHDE, MUTTA ERI OTSIKKO.
 *
 * `calculateMatch` tunnistaa saman energiakohteen paikannimesta
 * (`same_energy_site`, D-...) ja pitaa sita vahvana SIJAINTINA. Yollisen
 * skannauksen laatuportti ei kuitenkaan tunne sita: portti vaatii
 * otsikkotodisteen tai kuvaustodisteen >= 95 pisteesta.
 *
 * Portin oma perustelu kertoo saman asian toisin pain: ne kymmenen paria
 * jotka >= 95 kaistalla olivat aitoja, olivat nimenomaan "samaa tuuli-
 * tai aurinkovoimahanketta kahdesta lahteesta". Tunniste on siis jo
 * todettu luotettavaksi - se vain ei kelpaa todisteeksi.
 *
 * Tama listaa kaikki parit joissa `same_energy_site` on mukana, jotta
 * nakee montako paria portin muutos toisi ja ovatko ne aitoja.
 *
 *   npx tsx scripts/measure-energiakohdeparit.ts
 */

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
  console.log(`aktiivisia ${aktiiviset.length}, energiahankkeita ${energia.length}`)

  const parit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("project_duplicate_candidates").select("project_id_a, project_id_b, status").range(from, from + 999)
    if (error) throw error
    parit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const jonossa = new Map(parit.map((x) => [[x.project_id_a, x.project_id_b].sort().join("|"), x.status]))

  const loydetyt: any[] = []
  const nahdyt = new Set<string>()

  for (const a of energia) {
    for (const b of aktiiviset) {
      if (a.id === b.id) continue
      const avain = [a.id, b.id].sort().join("|")
      if (nahdyt.has(avain)) continue

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
      nahdyt.add(avain)
      loydetyt.push({ a, b, match, jono: jonossa.get(avain) ?? null })
    }
  }

  const uudet = loydetyt.filter((x) => !x.jono)
  const lapaisee = loydetyt.filter((x) => passesDuplicateQualityBar(x.match))
  console.log(`\nsame_energy_site -pareja ${loydetyt.length}`)
  console.log(`  jo jonossa:              ${loydetyt.length - uudet.length}`)
  console.log(`  lapaisee portin jo nyt:  ${lapaisee.length}`)
  console.log(`  UUSIA portin muutoksella: ${uudet.filter((x) => !passesDuplicateQualityBar(x.match)).length}`)

  console.log("\nkaikki parit luettavaksi:")
  for (const { a, b, match, jono } of loydetyt.sort((x, y) => y.match.confidence - x.match.confidence)) {
    console.log(`${String(match.confidence).padStart(3)} ${jono ? `[${jono}]` : "[uusi]"} ${String(a.city ?? "-").padEnd(14)} ${String(a.name).slice(0, 52)}`)
    console.log(`                            ${String(b.name).slice(0, 52)}`)
    console.log(`                            ${match.reasons.join(", ").slice(0, 84)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
