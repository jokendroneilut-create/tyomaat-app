import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HYVAKSYNNAN DUPLIKAATTIVIHJE HEITETAAN POIS.
 *
 * Hyvaksyntareitti tasmayttaa jokaisen ehdokkaan olemassa oleviin
 * hankkeisiin: >= 70 yhdistaa hankkeet, ja 40-69 kirjataan
 * `metadata.possible_duplicate_of`. Sita kenttaa ei lue mikaan - ei
 * kayttoliittyma eika ajastettu tyo. Mitattu 24.9.2026: kentta on
 * asetettu 1 499 hankkeelle, kun duplikaattijonossa on 204 paria.
 *
 * Yollinen skannaus (`scanForDuplicates`) on eri asia: se vertaa vain
 * SAMAAN ammeeseen osuvia hankkeita ja hylkaa laatuportissa
 * `name_in_description` -parit alle 95 pisteen. Tama tulostaa portin
 * paatoksen jokaiselle parille, jotta nakee kumpi on syy: ammejako vai
 * laatuportti.
 *
 *   npx tsx scripts/measure-hukatut-duplikaattivihjeet.ts
 *   npx tsx scripts/measure-hukatut-duplikaattivihjeet.ts --kaikki
 */

const KAIKKI = process.argv.includes("--kaikki")
const UUTISLAHTEET = new Set([
  "rakennuslehti", "stt_haku", "stt_julkaisijat", "helsinki_uutiset",
])

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { passesDuplicateQualityBar } = await import("../lib/agent/duplicates/qualityBar")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const pr: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, region, location, developer, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    pr.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const aktiiviset = pr.filter((p) => p.status === "active")
  const kohteet = KAIKKI
    ? aktiiviset
    : aktiiviset.filter((p) => UUTISLAHTEET.has(String(p.metadata?.source_name ?? "")))

  console.log(`aktiivisia ${aktiiviset.length}, tutkittavia ${kohteet.length}`)

  const parit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("project_duplicate_candidates").select("project_id_a, project_id_b").range(from, from + 999)
    if (error) throw error
    parit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const jonossa = new Set(parit.map((x) => [x.project_id_a, x.project_id_b].sort().join("|")))
  console.log(`duplikaattijonossa jo ${jonossa.size} paria`)

  const jakauma = new Map<string, number>()
  const lahteittain = new Map<string, number>()
  const nayte: any[] = []
  let n = 0

  for (const p of kohteet) {
    const t = findProjectMatchDetailed(aktiiviset.filter((x) => x.id !== p.id) as any, {
      name: p.name,
      sourceTitle: p.metadata?.source_title ?? null,
      city: p.city, region: p.region, location: p.location,
      permitNumber: p.metadata?.permit_number ?? null,
      propertyId: p.metadata?.property_id ?? null,
      developer: p.developer ?? p.metadata?.developer ?? null,
      buildingType: p.metadata?.building_type ?? null,
    } as any)

    n++
    if (n % 100 === 0) console.log(`  ${n}/${kohteet.length}`)

    if (!t || t.confidence < 40) continue
    if (jonossa.has([p.id, t.project.id].sort().join("|"))) continue

    const c = t.confidence
    const k = c >= 70 ? "70+" : c >= 60 ? "60-69" : c >= 50 ? "50-59" : "40-49"
    jakauma.set(k, (jakauma.get(k) ?? 0) + 1)
    const lahde = String(p.metadata?.source_name ?? "-")
    lahteittain.set(lahde, (lahteittain.get(lahde) ?? 0) + 1)

    if (c >= 60) nayte.push({ p, t })
  }

  console.log("")
  console.log("uusia pareja luottamuksen mukaan:")
  for (const k of ["70+", "60-69", "50-59", "40-49"]) if (jakauma.has(k)) console.log(`  ${k.padEnd(7)} ${String(jakauma.get(k)).padStart(5)}`)

  console.log("")
  console.log("lahteittain:")
  for (const [k, v] of [...lahteittain].sort((x, y) => y[1] - x[1]).slice(0, 12)) console.log(`  ${String(v).padStart(5)}  ${k}`)

  console.log("")
  console.log(`kaikki parit >= 60 (${nayte.length} kpl):`)
  for (const { p, t } of nayte.sort((x, y) => y.t.confidence - x.t.confidence)) {
    const portti = passesDuplicateQualityBar(t as any) ? "PORTTI OK" : "portti ei"
    console.log(`${String(t.confidence).padStart(3)} ${portti}  ${String(p.name).slice(0, 58)}`)
    console.log(`               ${String(t.project.name).slice(0, 58)}`)
    console.log(`               ${(t.reasons ?? []).join(", ").slice(0, 90)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
