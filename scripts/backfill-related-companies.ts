/*
 * Kirjoittaa voittajailmoitusten voittajat metadata.related_companies-kenttään.
 *
 * Hankekortti kokoaa yritykset source_historysta lennossa, mutta listanäkymä
 * ei voi tehdä niin: source_history on liian iso haettavaksi koko listaan
 * (metadata oli 58 % karttasivun siirretystä datasta). Voittajat viedään
 * siksi kenttään jonka lista jo hakee.
 *
 * Uudet hyväksynnät ja tuonnit tekevät tämän itse; tämä korjaa vanhat rivit.
 *
 *   npx tsx scripts/backfill-related-companies.ts
 *   npx tsx scripts/backfill-related-companies.ts --apply
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
  const { awardWinnersFromMetadata, mergeCompanyNames } = await import(
    "../lib/projects/projectCompanies"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, builder, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const plan: { row: any; before: string[]; after: string[] }[] = []

  for (const row of rows) {
    const before = Array.isArray(row.metadata?.related_companies)
      ? row.metadata.related_companies.map((c: unknown) => String(c))
      : []

    const after = mergeCompanyNames(before, awardWinnersFromMetadata(row.metadata))

    if (after.length === before.length && after.every((n, i) => n === before[i])) {
      continue
    }

    plan.push({ row, before, after })
  }

  console.log(`hankkeita: ${rows.length}`)
  console.log(`täydennettäviä: ${plan.length}\n`)

  for (const p of plan.slice(0, 25)) {
    console.log(`  "${String(p.row.name).slice(0, 50)}" (${p.row.city ?? "-"})`)
    console.log(`     ennen:   ${p.before.length === 0 ? "(tyhjä)" : p.before.join(", ").slice(0, 100)}`)
    console.log(`     jälkeen: ${p.after.join(", ").slice(0, 100)}`)
  }
  if (plan.length > 25) console.log(`  ... ja ${plan.length - 25} muuta`)

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  let done = 0
  for (const p of plan) {
    const { error } = await supabase
      .from("projects")
      .update({
        metadata: { ...(p.row.metadata ?? {}), related_companies: p.after },
      })
      .eq("id", p.row.id)

    if (error) throw error
    done += 1
    if (done % 25 === 0) process.stdout.write(`\rpäivitetty ${done}/${plan.length}`)
  }

  console.log(`\nvalmis: ${done} hanketta täydennetty`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
