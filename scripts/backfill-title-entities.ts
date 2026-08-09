/*
 * Purkaa jonossa olevien otsikoiden HTML-entiteetit.
 *
 * Entiteetit puretaan nyt keskitetysti tuonnissa (importCandidate), mutta
 * ennen sitä luodut rivit jäivät sellaisiksi kuin lähde ne antoi:
 *
 *   "...kohteessa Soukankuja 10&ndash;12"
 *   "Strateginen yleiskaava 2050 &#x2F; Kuopion yleiskaava 2050"
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-title-entities.ts
 *   npx tsx scripts/backfill-title-entities.ts --apply
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

const ENTITY = /&[a-zA-Z]+;|&#\d+;|&#x[0-9a-f]+;/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { decodeHtmlEntities } = await import("../lib/agent/htmlEntities")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r: any) => ENTITY.test(r.title ?? ""))
  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} riviä\n`
  )

  let virheet = 0
  for (const row of targets) {
    const title = decodeHtmlEntities(row.title)
    console.log(`[${row.metadata?.source ?? "?"}]`)
    console.log(`  ennen:   ${row.title}`)
    console.log(`  jälkeen: ${title}\n`)

    if (!APPLY) continue

    const { error } = await supabase
      .from("potential_projects")
      .update({
        title,
        metadata: { ...(row.metadata ?? {}), operation: title },
      })
      .eq("id", row.id)

    if (error) {
      console.log(`  VIRHE: ${error.message}`)
      virheet++
    }
  }

  if (APPLY) console.log(`valmis, virheitä ${virheet}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
