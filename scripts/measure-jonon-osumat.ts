import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ONKO JONOSSA ODOTTAVA EHDOKAS JO HANKKEENA?
 *
 * Tasmaytys ajetaan kahdesti: tuonnissa ja hyvaksynnassa. Valilla ei
 * mitaan - jonossa odottava ehdokas ei huomaa jos sen vastine hyvaksytaan
 * vasta myohemmin. Tama laskee kuinka monella jonorivilla olisi NYT
 * yhdistava osuma (>= 70).
 *
 *   npx tsx scripts/measure-jonon-osumat.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, region, location, developer, status, additional_info, metadata, property_type")
      .eq("status", "active")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const { data: jono, error: e2 } = await db
    .from("potential_projects")
    .select("id, title, municipality, created_at, metadata")
    .eq("status", "new")
  if (e2) throw e2

  console.log(`jonossa ${jono?.length ?? 0}, aktiivisia hankkeita ${hankkeet.length}\n`)

  const osumat: any[] = []
  for (const p of jono ?? []) {
    const md: any = (p as any).metadata ?? {}
    const t = findProjectMatchDetailed(hankkeet as any, {
      name: (p as any).title,
      sourceTitle: md.source_title ?? null,
      city: (p as any).municipality,
      region: md.region ?? null,
      location: md.project_address ?? null,
      permitNumber: md.permit_number ?? null,
      propertyId: md.property_id ?? null,
      developer: md.developer ?? null,
      buildingType: md.building_type ?? null,
      description: md.description ?? md.operation ?? null,
    } as any)
    if (t && t.confidence >= 70) osumat.push({ p, t })
  }

  console.log(`>= 70 osuma nyt: ${osumat.length} / ${jono?.length ?? 0}\n`)
  for (const { p, t } of osumat.sort((a, b) => b.t.confidence - a.t.confidence)) {
    console.log(`${String(t.confidence).padStart(3)}  ${String((p as any).municipality ?? "-").padEnd(12)} ${String((p as any).title).slice(0, 52)}`)
    console.log(`     hanke luotu ${String(t.project.created_at ?? "").slice(0, 10)}  ${String(t.project.name).slice(0, 52)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
