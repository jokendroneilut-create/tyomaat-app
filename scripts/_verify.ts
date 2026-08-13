import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

function passesQualityBar(match: any): boolean {
  if (match.confidence < 70) return false
  if (
    match.reasons.includes("same_permit_number") ||
    match.reasons.includes("same_property_id")
  ) return true
  const hasTitleEvidence =
    match.reasons.includes("exact_title") ||
    match.reasons.includes("exact_distinctive_title") ||
    match.reasons.includes("similar_title")
  return hasTitleEvidence && match.reasons.includes("same_city")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, cols: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  const all = await page("projects", "*")
  const live = all.filter((r: any) => r.status === "active" && r.is_public !== false)
  const known = await page("project_duplicate_candidates", "project_id_a, project_id_b")
  const seen = new Set(known.map((c: any) => [c.project_id_a, c.project_id_b].sort().join("|")))

  const byCity = new Map<string, any[]>()
  for (const r of live) {
    const key = r.city ?? "(tuntematon)"
    const arr = byCity.get(key) ?? []
    arr.push(r)
    byCity.set(key, arr)
  }

  const asCandidate = (a: any) => ({
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

  const fresh: any[] = []
  for (const [, group] of byCity) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (seen.has([group[i].id, group[j].id].sort().join("|"))) continue
        const match = calculateMatch(group[j], asCandidate(group[i]))
        if (!match || !passesQualityBar(match)) continue
        fresh.push({ a: group[i], b: group[j], conf: match.confidence })
      }
    }
  }

  console.log(`UUSIA ehdokkaita korjauksen jalkeen: ${fresh.length}  (ennen 68)`)
  const byCityCount: Record<string, number> = {}
  for (const f of fresh) byCityCount[f.a.city ?? "?"] = (byCityCount[f.a.city ?? "?"] ?? 0) + 1
  for (const [c, n] of Object.entries(byCityCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${c}`)
  }
  console.log("")
  for (const f of fresh.sort((a, b) => b.conf - a.conf).slice(0, 25)) {
    console.log(`  [${f.conf}] ${f.a.city}`)
    console.log(`        A: ${String(f.a.name).slice(0, 68)}`)
    console.log(`        B: ${String(f.b.name).slice(0, 68)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
