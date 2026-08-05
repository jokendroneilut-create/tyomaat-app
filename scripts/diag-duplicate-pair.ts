/*
 * Miksi kaksi hanketta ei tunnistu duplikaatiksi (tai tunnistuu).
 * Ajaa saman calculateMatchin ja laatuportin kuin skannaus.
 *
 *   npx tsx scripts/diag-duplicate-pair.ts "Datakeskus Kajaaniin"
 *   npx tsx scripts/diag-duplicate-pair.ts <uuid-a> <uuid-b>
 */
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

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))

const COLUMNS =
  "id,name,city,region,location,phase,completed_at,status,is_public,developer,property_type,metadata"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let projects: any[] = []

  if (args.length === 2 && args[0].includes("-") && args[0].length > 30) {
    const { data } = await supabase.from("projects").select(COLUMNS).in("id", args)
    projects = data ?? []
  } else {
    const { data } = await supabase.from("projects").select(COLUMNS).ilike("name", args[0])
    projects = data ?? []
  }

  if (projects.length < 2) {
    console.log(`löytyi ${projects.length} hanketta — tarvitaan vähintään 2`)
    for (const p of projects) console.log(`  ${p.id} "${p.name}"`)
    return
  }

  for (const p of projects) {
    console.log(`\n=== ${p.id} ===`)
    console.log(`  nimi:        ${p.name}`)
    console.log(`  kaupunki:    ${p.city ?? "-"}   maakunta: ${p.region ?? "-"}`)
    console.log(`  osoite:      ${p.location ?? "-"}`)
    console.log(`  vaihe:       ${p.phase ?? "-"}   tila: ${p.status ?? "-"}`)
    console.log(`  julkinen:    ${p.is_public}`)
    console.log(`  rakennuttaja:${p.developer ?? "-"}`)
    console.log(`  lupanumero:  ${p.metadata?.permit_number ?? "-"}`)
    console.log(`  kiinteistö:  ${p.metadata?.property_id ?? "-"}`)
    console.log(`  lähde:       ${p.metadata?.last_source_name ?? p.metadata?.source_name ?? "-"}`)
  }

  const { calculateMatch } = await import("../lib/agent/projectMatcher")

  console.log("\n=== TÄSMÄYTYS ===")
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i]
      const b = projects[j]
      const match = calculateMatch(a, b) ?? calculateMatch(b, a)

      console.log(`\n${a.id.slice(0, 8)} <-> ${b.id.slice(0, 8)}`)
      if (!match) {
        console.log("  calculateMatch: ei osumaa lainkaan (todiste-portti ei täyty)")
        continue
      }

      console.log(`  varmuus: ${match.confidence}`)
      console.log(`  syyt:    ${JSON.stringify(match.reasons)}`)

      const strong =
        match.reasons.includes("same_permit_number") ||
        match.reasons.includes("same_property_id")
      const title =
        match.reasons.includes("exact_title") ||
        match.reasons.includes("exact_distinctive_title") ||
        match.reasons.includes("similar_title")
      const passes =
        match.confidence >= 70 && (strong || (title && match.reasons.includes("same_city")))

      console.log(`  laatuportti: ${passes ? "LÄPI" : "EI LÄPI"}`)
      if (!passes) {
        if (match.confidence < 70) console.log(`    - varmuus ${match.confidence} < 70`)
        if (!strong && !title) console.log("    - ei nimi- eikä tunnistetodistetta")
        if (!strong && title && !match.reasons.includes("same_city")) {
          console.log("    - nimitodiste löytyi mutta kaupunki ei täsmää")
        }
      }

      const bothPublic = a.is_public && b.is_public
      console.log(`  molemmat julkisia: ${bothPublic}${bothPublic ? "" : " (skannaus ei näe paria)"}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
