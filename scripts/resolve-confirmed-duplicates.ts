/*
 * Purkaa jo vahvistetut duplikaatit: piilottaa toisen rivin ja siirtää
 * sen tiedot jäävälle.
 *
 * MIKSI NÄITÄ ON. Katselmoinnissa pari merkitään
 * `confirmed_duplicate`-tilaan, mutta se on päätös - ei toimenpide.
 * Piilotus on erillinen askel, ja niiden välissä vuotaa. Mitattu
 * 13.8.2026: 41 vahvistetusta parista **21:llä molemmat rivit olivat yhä
 * asiakkaan listalla**.
 *
 * KUMPI JÄÄ. Se rivi jolla on enemmän tietoa: pisteytys laskee täytetyt
 * kentät ja kuvauksen pituuden. Tasapelissä pidempi kuvaus voittaa.
 * Valinta ei ole makuasia vaan mitattava - väärin päin tehtynä
 * hävitettäisiin se rivi jossa on rakennuttaja ja kustannus.
 *
 * TIETO SIIRRETÄÄN ENNEN PIILOTUSTA. Tyhjät kentät täydennetään
 * piilotettavalta, ja kuvaukset LIITETÄÄN eikä korvata - sama oppi kuin
 * tuulihankkeiden yhdistämisessä, jossa korvaaminen hävitti kaavarivin
 * tiedon hankkeen keskeytymisestä.
 *
 *   npx tsx scripts/resolve-confirmed-duplicates.ts
 *   npx tsx scripts/resolve-confirmed-duplicates.ts --apply
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

/* Kentät jotka siirretään jos ne puuttuvat jäävältä riviltä. */
const CARRIED = [
  "developer",
  "builder",
  "property_type",
  "estimated_cost",
  "estimated_completion",
  "location",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "floor_area",
  "apartments",
] as const

function completeness(r: any): number {
  let score = 0
  for (const key of CARRIED) if (r[key]) score++
  if (r.metadata?.source_url) score++
  score += Math.min(4, Math.floor(String(r.additional_info ?? "").length / 500))
  return score
}

function mergeDescriptions(keep: string, hide: string): string {
  const a = keep.trim()
  const b = hide.trim()
  if (!a) return b
  if (!b) return a
  if (a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n\n${b}`
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

  const all = await page("projects", "*")
  const byId = new Map(all.map((r: any) => [r.id, r]))
  const cands = await page("project_duplicate_candidates", "*")

  const visible = (r: any) => r && r.status === "active" && r.is_public !== false

  const work: { keep: any; hide: any; confidence: number }[] = []
  for (const c of cands) {
    if (c.status !== "confirmed_duplicate") continue
    const a = byId.get(c.project_id_a)
    const b = byId.get(c.project_id_b)
    if (!visible(a) || !visible(b)) continue

    const aScore = completeness(a)
    const bScore = completeness(b)
    const aWins =
      aScore > bScore ||
      (aScore === bScore &&
        String(a.additional_info ?? "").length >= String(b.additional_info ?? "").length)

    work.push({ keep: aWins ? a : b, hide: aWins ? b : a, confidence: c.confidence })
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  vahvistettuja pareja joissa molemmat nakyvissa: ${work.length}\n`
  )

  let enriched = 0
  for (const { keep, hide, confidence } of work) {
    const gains: string[] = []
    for (const key of CARRIED) if (!keep[key] && hide[key]) gains.push(key)
    const merged = mergeDescriptions(
      String(keep.additional_info ?? ""),
      String(hide.additional_info ?? "")
    )
    if (merged !== String(keep.additional_info ?? "").trim()) gains.push("kuvaus")
    if (gains.length) enriched++

    console.log(`  [${confidence}] ${keep.city ?? "?"}  ${String(keep.name).slice(0, 54)}`)
    console.log(`         piiloon: ${String(hide.name).slice(0, 60)}`)
    if (gains.length) console.log(`         siirtyy: ${gains.join(", ")}`)
  }
  console.log(`\n  rivia joille siirtyy tietoa: ${enriched}`)

  if (!APPLY) return

  let done = 0
  for (const { keep, hide } of work) {
    const patch: Record<string, any> = {}
    for (const key of CARRIED) if (!keep[key] && hide[key]) patch[key] = hide[key]

    const merged = mergeDescriptions(
      String(keep.additional_info ?? ""),
      String(hide.additional_info ?? "")
    )
    if (merged !== String(keep.additional_info ?? "").trim()) patch.additional_info = merged

    if (!keep.metadata?.source_url && hide.metadata?.source_url) {
      patch.metadata = { ...keep.metadata, source_url: hide.metadata.source_url }
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("projects").update(patch).eq("id", keep.id)
      if (error) console.log(`  VIRHE (jaava) ${keep.id}: ${error.message}`)
    }

    const { error: hideError } = await supabase
      .from("projects")
      .update({
        is_public: false,
        metadata: { ...hide.metadata, duplicate_of: keep.id },
      })
      .eq("id", hide.id)
    if (hideError) console.log(`  VIRHE (piilo) ${hide.id}: ${hideError.message}`)
    else done++
  }
  console.log(`\npiilotettu: ${done}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
