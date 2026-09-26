import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHDEN LAHTEEN JONORIVIEN OSUMAT OLEMASSA OLEVIIN HANKKEISIIN.
 *
 * Sama tasmaytys kuin hyvaksyntareitilla: vertailujoukko on ehdokkaan
 * MAAKUNTA (tai koko kanta jos maakuntaa ei ole), ei suodatusta
 * julkisuuden tai tilan mukaan. Rajat ovat samat: >= 70 yhdistaa,
 * 40-69 on vihje.
 *
 *   npx tsx scripts/measure-lahteen-osumat.ts are
 */
const LAHDE = process.argv.find((a) => !a.startsWith("-") && !a.endsWith(".ts") && !a.includes("node")) ?? "are"
/* "kaikki" = koko jono lahteittain eriteltyna. */
const KAIKKI = LAHDE === "kaikki"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata,is_public,additional_info")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  let kysely = db
    .from("potential_projects")
    .select("id, title, municipality, metadata")
    .eq("status", "new")
  if (!KAIKKI) kysely = kysely.eq("metadata->>source_name", LAHDE)
  const { data: jono, error } = await kysely
  if (error) throw error

  console.log(`lahde "${LAHDE}": ${jono?.length ?? 0} jonorivia, vertailujoukko ${hankkeet.length} hanketta\n`)

  const luokat = { yli70: 0, v40: 0, alle40: 0, eiMitaan: 0 }
  const rivit: any[] = []

  for (const p of jono ?? []) {
    const md: any = (p as any).metadata ?? {}
    const alue = md.region
      ? hankkeet.filter((h) => h.region === md.region)
      : hankkeet

    const t = findProjectMatchDetailed(alue as any, {
      name: (p as any).title,
      sourceTitle: md.source_title ?? null,
      city: (p as any).municipality,
      region: md.region ?? null,
      location: md.project_address ?? null,
      permitNumber: null,
      propertyId: null,
      developer: md.developer ?? null,
      buildingType: md.building_type ?? null,
      description: md.description ?? null,
    } as any)

    if (!t) luokat.eiMitaan++
    else if (t.confidence >= 70) luokat.yli70++
    else if (t.confidence >= 40) luokat.v40++
    else luokat.alle40++

    rivit.push({ p, t })
  }

  console.log(`>= 70 (yhdistaisi):  ${luokat.yli70}`)
  console.log(`40-69 (vihje):       ${luokat.v40}`)
  console.log(`< 40:                ${luokat.alle40}`)
  console.log(`ei osumaa lainkaan:  ${luokat.eiMitaan}`)

  console.log("\nkaikki rivit luettavaksi:")
  for (const { p, t } of rivit.sort((a, b) => (b.t?.confidence ?? -1) - (a.t?.confidence ?? -1))) {
    const md: any = (p as any).metadata ?? {}
    console.log(
      `${String(t?.confidence ?? "-").padStart(3)}  ${String((p as any).municipality ?? "-").padEnd(12)} ${String((p as any).title).slice(0, 56)}`
    )
    if (t) {
      console.log(`     -> ${String(t.project.name).replace(/\u200b/g, "").slice(0, 56)}  [${t.project.phase}${t.project.is_public ? "" : ", piilotettu"}]`)
      console.log(`        ${t.reasons.join(", ").slice(0, 86)}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
