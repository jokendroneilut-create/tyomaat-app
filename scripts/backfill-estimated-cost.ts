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
  const { resolveProjectCost } = await import("../lib/projects/resolveProjectCost")

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

  const euro = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)} M€`.padStart(10)
      : `${Math.round(n).toLocaleString("fi")} €`.padStart(10)

  const tally = (hits: { resolved: { cost_source: string } }[]) => {
    const t = new Map<string, number>()
    for (const h of hits) t.set(h.resolved.cost_source, (t.get(h.resolved.cost_source) ?? 0) + 1)
    return [...t].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")
  }

  /* Jono: arvo metadataan, josta hyväksyntä siirtää sen sarakkeeseen. */
  const queue = await page("potential_projects", "id, title, metadata")
  const queueHits = queue
    .map((r: any) => ({
      r,
      resolved: resolveProjectCost({
        contractValue: r.metadata?.contract_value,
        text: [r.metadata?.description, r.metadata?.operation, r.title]
          .filter(Boolean)
          .join(" "),
        existingCost: r.metadata?.estimated_cost,
        existingSource: r.metadata?.cost_source,
      }),
    }))
    .filter(
      (x): x is { r: any; resolved: NonNullable<typeof x.resolved> } =>
        x.resolved !== null &&
        (Number(x.r.metadata?.estimated_cost ?? 0) !== x.resolved.estimated_cost ||
          x.r.metadata?.cost_source !== x.resolved.cost_source)
    )

  console.log(
    `potential_projects: ${queue.length} rivia, kirjoitettavaa ${queueHits.length} (${tally(queueHits)})`
  )
  for (const { r, resolved } of queueHits.slice(0, 8)) {
    console.log(
      `  ${euro(resolved.estimated_cost)}  [${resolved.cost_source}]  ${String(r.title).slice(0, 46)}`
    )
  }

  /* Hyväksytyt: arvo suoraan sarakkeeseen. */
  const live = await page("projects", "id, name, estimated_cost, additional_info, metadata")
  const liveHits = live
    .map((r: any) => ({
      r,
      resolved: resolveProjectCost({
        contractValue: r.metadata?.contract_value,
        text: [r.additional_info, r.metadata?.description, r.metadata?.operation]
          .filter(Boolean)
          .join(" "),
        existingCost: r.estimated_cost,
        existingSource: r.metadata?.cost_source,
      }),
    }))
    .filter(
      (x): x is { r: any; resolved: NonNullable<typeof x.resolved> } =>
        x.resolved !== null &&
        (Number(x.r.estimated_cost ?? 0) !== x.resolved.estimated_cost ||
          x.r.metadata?.cost_source !== x.resolved.cost_source)
    )

  const newValues = liveHits.filter((x) => !Number(x.r.estimated_cost ?? 0))

  console.log(
    `\nprojects: ${live.length} rivia, kirjoitettavaa ${liveHits.length} (${tally(liveHits)})`
  )
  console.log(
    `  ...joista uusi arvo tyhjaan kenttaan: ${newValues.length}` +
      `, olemassa olevan tarkennus: ${liveHits.length - newValues.length}`
  )
  for (const { r, resolved } of liveHits.slice(0, 8)) {
    console.log(
      `  ${euro(resolved.estimated_cost)}  [${resolved.cost_source}]  ${String(r.name).slice(0, 46)}`
    )
  }

  const before = live.filter((r: any) => Number(r.estimated_cost) > 0).length
  const after = before + newValues.length
  console.log(
    `\n  kattavuus: ${before} -> ${after} / ${live.length}` +
      ` (${Math.round((before / live.length) * 100)} % -> ${Math.round((after / live.length) * 100)} %)`
  )

  if (!APPLY) return

  let done = 0
  for (const { r, resolved } of queueHits) {
    const { error } = await supabase
      .from("potential_projects")
      .update({
        metadata: {
          ...r.metadata,
          estimated_cost: resolved.estimated_cost,
          cost_source: resolved.cost_source,
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done++
  }
  console.log(`\njonoon kirjoitettu: ${done}`)

  let done2 = 0
  for (const { r, resolved } of liveHits) {
    const { error } = await supabase
      .from("projects")
      .update({
        estimated_cost: resolved.estimated_cost,
        metadata: {
          ...r.metadata,
          estimated_cost: resolved.estimated_cost,
          cost_source: resolved.cost_source,
        },
      })
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
