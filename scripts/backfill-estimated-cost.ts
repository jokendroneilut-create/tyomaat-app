/*
 * Poimii hankkeen kustannusarvion kuvaustekstistä.
 *
 * `estimated_cost` on ollut olemassa sarakkeena ja näkyy asiakkaalle
 * koosteessa, mutta mikään ei ole kirjoittanut siihen mitään tekstistä.
 *
 * TARKKUUS ENNEN KATTAVUUTTA. Poimija ankkuroi nimettyyn lauseeseen
 * (kustannusarvio, urakan arvo, investointikustannus) eikä pelkkään
 * summan läheisyyteen. Mitattu ero 12.8.2026: läheisyysehdolla 391
 * osumaa joista useita vääriä - koko maan vuosibudjetti, palveluhankinnan
 * arvo, yrityksen tilauskanta - ankkuroituna 49 osumaa joista jokainen
 * tarkistettuna oikea.
 *
 * Loput 620 summamainintaa jäävät poimimatta. Se on tarkoituksellista:
 * väärä kustannus näkyy asiakkaalle numerona jota hän uskoo, kun taas
 * tyhjä kenttä ei valehtele. Ankkurilistaa voi kasvattaa kun uusia
 * muotoja mitataan.
 *
 *   npx tsx scripts/backfill-estimated-cost.ts
 *   npx tsx scripts/backfill-estimated-cost.ts --apply
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
  const { extractCostFromText } = await import("../lib/projects/extractCostFromText")

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

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  /* Jono: arvo metadataan, josta hyväksyntä siirtää sen sarakkeeseen. */
  const queue = await page("potential_projects", "id, title, metadata")
  const queueHits = queue
    .map((r: any) => ({
      r,
      cost: extractCostFromText(String(r.metadata?.description ?? "")),
    }))
    .filter((x) => x.cost !== null && x.r.metadata?.estimated_cost !== x.cost)

  console.log(`potential_projects: ${queue.length} rivia, poimittiin ${queueHits.length}`)
  for (const { r, cost } of queueHits.slice(0, 10)) {
    console.log(
      `  ${String((cost! / 1_000_000).toFixed(1)).padStart(7)} M€  ${String(r.title).slice(0, 56)}`
    )
  }

  /* Hyväksytyt: arvo suoraan sarakkeeseen, mutta ei ylikirjoiteta. */
  const live = await page("projects", "id, name, estimated_cost, additional_info, metadata")
  const liveHits = live
    .map((r: any) => ({
      r,
      cost: extractCostFromText(
        String(r.additional_info ?? r.metadata?.description ?? "")
      ),
    }))
    .filter((x) => x.cost !== null && !x.r.estimated_cost)

  console.log(`\nprojects: ${live.length} rivia, poimittiin ${liveHits.length}`)
  for (const { r, cost } of liveHits.slice(0, 10)) {
    console.log(
      `  ${String((cost! / 1_000_000).toFixed(1)).padStart(7)} M€  ${String(r.name).slice(0, 56)}`
    )
  }
  console.log(
    `  (ohitettu ${live.filter((r: any) => r.estimated_cost).length} rivia joilla arvo on jo)`
  )

  if (!APPLY) return

  let done = 0
  for (const { r, cost } of queueHits) {
    const { error } = await supabase
      .from("potential_projects")
      .update({ metadata: { ...r.metadata, estimated_cost: cost } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done++
  }
  console.log(`\njonoon kirjoitettu: ${done}`)

  let done2 = 0
  for (const { r, cost } of liveHits) {
    const { error } = await supabase
      .from("projects")
      .update({ estimated_cost: cost, metadata: { ...r.metadata, estimated_cost: cost } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done2++
  }
  console.log(`hankkeisiin kirjoitettu: ${done2}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
