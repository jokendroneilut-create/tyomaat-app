/*
 * Yhdistää jo tietokannassa olevat tuuli-/aurinkohankeparit, jotka
 * uusi `same_energy_site`-sääntö tunnistaa samaksi hankkeeksi.
 *
 * MIKSI ERILLINEN AJO. Täsmäytys ajetaan tuonnin yhteydessä, joten
 * sääntö estää uudet duplikaatit muttei pura vanhoja: parit ovat jo
 * kannassa erillisinä riveinä.
 *
 * VAIN VARMAT. Mukaan otetaan ainoastaan parit jotka ylittävät
 * yhdistämiskynnyksen 70 - eli joilla paikannimen lisäksi on otsikko-,
 * kuvaus- tai rakennuttajatodiste. Pelkän paikannimen varassa olevat
 * (65) jätetään jonoon ihmisen katsottavaksi, koska koodissa on jo
 * maksettu oppi maantieteen varassa yhdistämisestä (16 väärää osumaa
 * 73 pisteellä, purettu unmerge-wrong-matches.ts:llä).
 *
 * MITÄ KIRJOITETAAN. Jonorivi merkitään `ignored`-tilaan ja linkitetään
 * olemassa olevaan hankkeeseen (`matched_existing_project_id`), jolloin
 * se katoaa jonosta ja asiakasnäkymästä mutta historia säilyy. Hankkeen
 * tyhjät kentät täydennetään YVA-rivin tiedoilla - ei ylikirjoiteta,
 * koska jonorivi on lähde vain sille mitä hankkeelta puuttuu.
 *
 *   npx tsx scripts/merge-energy-site-duplicates.ts
 *   npx tsx scripts/merge-energy-site-duplicates.ts --apply
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

const MERGE_THRESHOLD = 70

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

  const queue = (
    await page("potential_projects", "id, title, municipality, status, metadata")
  ).filter((r: any) => r.status === "new")
  const live = await page("projects", "*")

  const byCity = new Map<string, any[]>()
  for (const p of live) {
    if (!p.city) continue
    const arr = byCity.get(p.city) ?? []
    arr.push(p)
    byCity.set(p.city, arr)
  }

  /* Paras osuma per jonorivi - sama valinta kuin tuonnissa. */
  const decisions: { q: any; p: any; confidence: number; fills: string[] }[] = []
  let belowThreshold = 0

  for (const q of queue) {
    if (!q.municipality) continue

    let best: { p: any; confidence: number } | null = null
    for (const p of byCity.get(q.municipality) ?? []) {
      const result = calculateMatch(
        {
          id: p.id,
          name: p.name,
          city: p.city,
          region: p.region,
          location: p.location,
          phase: p.phase,
          developer: p.developer,
          property_type: p.property_type,
          additional_info: p.additional_info,
          metadata: p.metadata,
        },
        {
          name: q.title,
          sourceTitle: q.metadata?.operation ?? q.title,
          city: q.municipality,
          region: q.metadata?.region ?? null,
          developer: q.metadata?.developer ?? null,
          description: q.metadata?.description ?? null,
        }
      )
      if (!result?.reasons.includes("same_energy_site")) continue
      if (!best || result.confidence > best.confidence) {
        best = { p, confidence: result.confidence }
      }
    }

    if (!best) continue
    if (best.confidence < MERGE_THRESHOLD) {
      belowThreshold++
      continue
    }

    const fills: string[] = []
    if (!best.p.developer && q.metadata?.developer) fills.push("developer")
    if (
      String(best.p.additional_info ?? "").length <
      String(q.metadata?.description ?? "").length
    ) {
      fills.push("kuvaus (jonorivi pidempi)")
    }

    decisions.push({ q, p: best.p, confidence: best.confidence, fills })
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  jonossa ${queue.length}, hankkeita ${live.length}\n` +
      `  yhdistetaan (>=${MERGE_THRESHOLD}): ${decisions.length}\n` +
      `  jatetaan jonoon ehdotukseksi (<${MERGE_THRESHOLD}): ${belowThreshold}\n`
  )

  for (const d of decisions) {
    console.log(`  [${d.confidence}] ${d.q.municipality}`)
    console.log(`      jono   ${String(d.q.title).slice(0, 68)}`)
    console.log(`      hanke  ${String(d.p.name).slice(0, 68)}`)
    console.log(
      `      taydennetaan: ${d.fills.length ? d.fills.join(", ") : "ei mitaan (hankkeella jo kaikki)"}`
    )
  }

  if (!APPLY) return

  let merged = 0
  let enriched = 0

  for (const d of decisions) {
    const patch: Record<string, any> = {}
    if (!d.p.developer && d.q.metadata?.developer) patch.developer = d.q.metadata.developer
    if (
      String(d.p.additional_info ?? "").length <
      String(d.q.metadata?.description ?? "").length
    ) {
      patch.additional_info = d.q.metadata.description
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("projects").update(patch).eq("id", d.p.id)
      if (error) console.log(`  VIRHE hanke ${d.p.id}: ${error.message}`)
      else enriched++
    }

    const { error: qErr } = await supabase
      .from("potential_projects")
      .update({
        status: "ignored",
        metadata: {
          ...(d.q.metadata ?? {}),
          matched_existing_project_id: d.p.id,
          merged_reason: "same_energy_site",
        },
      })
      .eq("id", d.q.id)
    if (qErr) console.log(`  VIRHE jono ${d.q.id}: ${qErr.message}`)
    else merged++
  }

  console.log(`\nyhdistetty: ${merged}, taydennettyja hankkeita: ${enriched}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
