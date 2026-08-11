/*
 * Palauttaa kaavarivin kuvauksen hankkeille, joilla yhdistäminen korvasi
 * sen YVA-rivin tekstillä.
 *
 * OMA VIRHE, KORJATTAVISSA. `merge-energy-site-duplicates.ts` otti
 * ensimmäisessä versiossaan pidemmän kuvauksen kahdesta. YVA-teksti on
 * lähes aina pidempi, joten kaavarivin oma teksti hävisi 25 hankkeelta.
 * Se ei ole vain muotoseikka: kaavateksti kertoo hankkeen ETENEMISEN
 * (nähtävilläolot, valitukset, keskeytykset), kun YVA-teksti kertoo vain
 * suunnitelman. Ranualla juuri kaavateksti sisälsi tiedon siitä että
 * hanketoimija keskeytti kaavoituksen.
 *
 * Alkuperäinen teksti on tallessa `source_documents.raw_payload`issa,
 * joten se voidaan lukea takaisin ja liittää nykyisen kuvauksen ETEEN -
 * kaavateksti ensin, koska se on tuoreempi tieto hankkeen tilasta.
 *
 * Skripti on idempotentti: jos teksti on jo mukana, riviin ei kosketa.
 *
 *   npx tsx scripts/restore-merged-kaava-descriptions.ts
 *   npx tsx scripts/restore-merged-kaava-descriptions.ts --apply
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

  const merged = (await page("potential_projects", "id, title, metadata")).filter(
    (r: any) => r.metadata?.merged_reason === "same_energy_site"
  )
  const live = await page("projects", "id, name, metadata, additional_info")
  const docs = await page("source_documents", "document_url, raw_payload")

  const byUrl = new Map<string, string>()
  for (const d of docs) {
    const desc = d.raw_payload?.description
    if (typeof desc === "string" && desc.trim()) byUrl.set(d.document_url, desc.trim())
  }

  const fixes: { p: any; restored: string; next: string }[] = []
  let intact = 0

  for (const q of merged) {
    const p = live.find((x: any) => x.id === q.metadata.matched_existing_project_id)
    if (!p) continue

    const original = p.metadata?.source_url ? byUrl.get(p.metadata.source_url) : undefined
    if (!original) continue

    const now = String(p.additional_info ?? "").trim()
    if (now.includes(original.slice(0, 60))) {
      intact++
      continue
    }

    fixes.push({ p, restored: original, next: now ? `${original}\n\n${now}` : original })
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  yhdistettyja pareja: ${merged.length}\n` +
      `  kaavateksti tallella: ${intact}\n` +
      `  palautetaan:         ${fixes.length}\n`
  )

  for (const f of fixes.slice(0, 8)) {
    console.log(
      `  ${String(f.p.name).slice(0, 52).padEnd(54)} ${String(f.p.additional_info ?? "").length} -> ${f.next.length} mrk`
    )
  }

  if (!APPLY) return

  let done = 0
  for (const f of fixes) {
    const { error } = await supabase
      .from("projects")
      .update({ additional_info: f.next })
      .eq("id", f.p.id)
    if (error) console.log(`  VIRHE ${f.p.id}: ${error.message}`)
    else done++
  }
  console.log(`\npalautettu: ${done}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
