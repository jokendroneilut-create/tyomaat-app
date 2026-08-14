/*
 * Täydentää urakoitsijan uutisotsikosta riveille joilta se puuttuu.
 *
 * MIKSI NÄITÄ ON. Yritysten omilla sivuilla urakoitsija tulee
 * julkaisijasta (`createCompanyEnricher`), mutta uutislähteillä -
 * Rakennuslehti, kaupunkien uutiset - julkaisija on toimitus, jolloin
 * kenttä jäi tyhjäksi vaikka otsikko kertoo tekijän suoraan.
 *
 * TARKKUUS MITATTU OLEMASSA OLEVAA DATAA VASTEN. Sääntö osuu 57 riviin,
 * joista 42:lla urakoitsija on jo kirjattu - ja se on sama nimi.
 * Loput 15 ovat täydennettäviä.
 *
 *   npx tsx scripts/backfill-builder-from-headline.ts
 *   npx tsx scripts/backfill-builder-from-headline.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

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
  const { builderFromHeadline } = await import("../lib/agent/builderFromHeadline")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  for (const [table, titleKey, hasColumn] of [
    ["projects", "name", true],
    ["potential_projects", "title", false],
  ] as const) {
    const rows = await page(table)
    const live =
      table === "projects"
        ? rows.filter((r: any) => r.status === "active" && r.is_public !== false)
        : rows.filter((r: any) => r.status === "new")

    let agree = 0
    const hits: { r: any; builder: string }[] = []

    for (const r of live) {
      const builder = builderFromHeadline(r[titleKey])
      if (!builder) continue

      const current = hasColumn ? r.builder : r.metadata?.builder
      if (current) {
        agree++
        continue
      }
      hits.push({ r, builder })
    }

    console.log(`${table}: ${live.length} riviä`)
    console.log(`  sääntö vahvistaa olemassa olevan: ${agree}`)
    console.log(`  täydennettäviä:                   ${hits.length}`)
    for (const h of hits.slice(0, 10)) {
      console.log(`    ${h.builder.padEnd(20)} <- ${String(h.r[titleKey]).slice(0, 52)}`)
    }
    console.log("")

    if (!APPLY) continue

    let done = 0
    for (const { r, builder } of hits) {
      const patch: Record<string, any> = hasColumn
        ? { builder, metadata: { ...r.metadata, builder } }
        : { metadata: { ...r.metadata, builder } }

      const { error } = await supabase.from(table).update(patch).eq("id", r.id)
      if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
      else done++
    }
    console.log(`  kirjoitettu: ${done}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
