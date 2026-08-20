import { readFileSync, writeFileSync, existsSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mita otsikkovertailun muutos tekee duplikaattijonolle?
 *
 * Ajetaan SAMA pareittainen lapikaynti ja SAMA laatuportti kuin
 * scanForDuplicates, mutta ilman kirjoitusta. Aja kerran ennen muutosta
 * (--baseline) ja kerran sen jalkeen: skripti kertoo mitka parit ovat uusia.
 *
 * Talla muutoksella on merkitysta myos automaattiselle yhdistamiselle, joten
 * pelkka "toimii siina tapauksessa jonka kayttaja loysi" ei riita.
 */

const BASELINE_FILE = "C:/Users/johan/AppData/Local/Temp/claude/C--Users-johan-tyomaat-app-app/e709baee-8f55-4e09-92ad-d73c4fd628d2/scratchpad/dup-baseline.json"
const IS_BASELINE = process.argv.includes("--baseline")

function passesDuplicateQualityBar(match: any): boolean {
  if (match.confidence < 70) return false
  if (match.reasons.includes("same_permit_number") || match.reasons.includes("same_property_id")) return true
  const hasTitleEvidence =
    match.reasons.includes("exact_title") ||
    match.reasons.includes("exact_distinctive_title") ||
    match.reasons.includes("similar_title")
  return hasTitleEvidence && match.reasons.includes("same_city")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const { buildComparisonBuckets, comparisonPartners } = await import("../lib/agent/duplicates/comparisonBuckets")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata")
      .eq("is_public", true)
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`julkisia hankkeita: ${projects.length}`)

  const buckets = buildComparisonBuckets(projects as any)
  const seen = new Set<string>()
  const pairs = new Map<string, { confidence: number; reasons: string[]; a: string; b: string }>()
  let compared = 0

  for (const a of projects) {
    for (const b of comparisonPartners(a as any, buckets)) {
      const [idA, idB] = [a.id, (b as any).id].sort()
      const key = `${idA}:${idB}`
      if (seen.has(key)) continue
      seen.add(key)
      compared++

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
      } as any)

      if (!match) continue
      if (!passesDuplicateQualityBar(match)) continue

      pairs.set(key, {
        confidence: match.confidence,
        reasons: match.reasons,
        a: String(a.name).slice(0, 60),
        b: String((b as any).name).slice(0, 60),
      })
    }
  }

  console.log(`vertailtuja pareja: ${compared}`)
  console.log(`laatuportin lapaisseita: ${pairs.size}`)

  if (IS_BASELINE) {
    writeFileSync(BASELINE_FILE, JSON.stringify([...pairs.keys()]))
    console.log(`\nlahtotaso tallennettu (${pairs.size} paria)`)
    return
  }

  if (!existsSync(BASELINE_FILE)) {
    console.log("\nEI LAHTOTASOA - aja ensin --baseline ennen muutosta")
    return
  }

  const before = new Set<string>(JSON.parse(readFileSync(BASELINE_FILE, "utf8")))
  const added = [...pairs.keys()].filter((k) => !before.has(k))
  const removed = [...before].filter((k) => !pairs.has(k))

  console.log(`\nlahtotaso:    ${before.size} paria`)
  console.log(`nyt:          ${pairs.size} paria`)
  console.log(`UUSIA:        ${added.length}`)
  console.log(`POISTUNEITA:  ${removed.length}`)

  console.log("\nuudet parit:")
  for (const key of added.slice(0, 40)) {
    const p = pairs.get(key)!
    console.log(`  ${String(p.confidence).padStart(3)}  ${p.a}`)
    console.log(`       ${p.b}`)
    console.log(`       ${p.reasons.join(", ")}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
