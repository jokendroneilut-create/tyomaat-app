/*
 * Työlista katselmointijonosta: mille ehdokkaille löytyy jo olemassa oleva
 * hanke, ja kuinka varmasti.
 *
 * TIC laskee ehdotukset sivun latauksessa, joten tämä ei muuta mitään - se
 * kertoo etukäteen mitkä kortit kannattaa avata ensin, jottei 144:ää tarvitse
 * käydä läpi umpimähkään.
 *
 * Käyttää samaa findProjectMatchDetailed-funktiota kuin agentin tuonti, joten
 * luvut vastaavat sitä mitä kortilla näkyy.
 *
 *   npx tsx scripts/report-queue-matches.ts
 *   npx tsx scripts/report-queue-matches.ts --status=new --min=40
 */
import { readFileSync } from "node:fs"

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null

const STATUS = arg("status") ?? "new"
const MIN = Number(arg("min") ?? 30)
const BASE_URL = "https://app.tyomaat.fi/tic/projects"

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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id,name,city,region,location,phase,completed_at,status,developer," +
          "property_type,additional_info,metadata"
      )
      // Yhdistetty hanke ei ole enää täsmäytyksen kohde.
      .is("metadata->>merged_into_project_id", null)
      .range(from, from + 999)

    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const { data: candidates, error: candidateError } = await supabase
    .from("potential_projects")
    .select("id, title, municipality, address, created_at, metadata")
    .eq("status", STATUS)
    .order("created_at", { ascending: false })

  if (candidateError) throw candidateError

  const rows: any[] = []

  for (const candidate of candidates ?? []) {
    const md: any = candidate.metadata ?? {}

    const match = findProjectMatchDetailed(projects, {
      name: candidate.title,
      sourceTitle: md.source_title ?? null,
      city: candidate.municipality,
      region: md.region ?? null,
      location: (candidate as any).address,
      permitNumber: md.permit_number ?? null,
      propertyId: md.property_id ?? null,
      developer: md.developer ?? null,
      buildingType: md.building_type ?? null,
      description: md.description ?? null,
    })

    rows.push({ candidate, match })
  }

  const auto = rows.filter((r) => r.match && r.match.confidence >= 70)
  const check = rows.filter(
    (r) => r.match && r.match.confidence >= MIN && r.match.confidence < 70
  )
  const fresh = rows.filter((r) => !r.match || r.match.confidence < MIN)

  function print(title: string, list: any[]) {
    console.log(`\n${"=".repeat(72)}`)
    console.log(`${title} (${list.length})`)
    console.log("=".repeat(72))

    for (const r of list) {
      const c = r.candidate
      console.log(`\n${r.match ? String(r.match.confidence).padStart(3) : "  -"}  ${String(c.title).slice(0, 66)}`)
      console.log(`     ${c.municipality ?? "(ei kuntaa)"}  ·  ${c.created_at.slice(0, 10)}`)
      if (r.match) {
        console.log(`     -> ${String(r.match.project.name).slice(0, 62)}`)
        console.log(`        ${r.match.reasons.join(", ")}`)
      }
      console.log(`     ${BASE_URL}/${c.id}`)
    }
  }

  console.log(`jonossa ${rows.length} ehdokasta, hankkeita ${projects.length}`)
  print("YHDISTETTÄVISSÄ — osuma >= 70, sama kuin agentti yhdistäisi", auto)
  print(`TARKISTETTAVAT — osuma ${MIN}-69, ihminen ratkaisee`, check)

  console.log(`\n${"=".repeat(72)}`)
  console.log(`TODENNÄKÖISESTI UUSIA (${fresh.length}) — ei osumaa yli ${MIN}:n`)
  console.log("=".repeat(72))
  for (const r of fresh) {
    console.log(`  ${String(r.candidate.title).slice(0, 62).padEnd(64)} ${r.candidate.municipality ?? "-"}`)
  }

  console.log(
    `\nYHTEENVETO: ${auto.length} yhdistettävissä, ${check.length} tarkistettavaa, ${fresh.length} uutta`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
