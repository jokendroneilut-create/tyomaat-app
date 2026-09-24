import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TUONNIN VUOTO: montako kandidaattia yksi lähdeajo ehtii tuoda?
 *
 * Epäily: `ehtiiViela` varaa keskiarvo x rinnakkaisuus, mikä ylittää koko
 * 70 s budjetin heti kun kandidaatti maksaa yli ~12 s. Silloin ajo tuo
 * tasan CANDIDATE_CONCURRENCY (6) kandidaattia eikä yhtään enempää.
 *
 *   npx tsx scripts/measure-tuonnin-vuoto.ts
 */

/* Saman ajon tapahtumat ovat minuuttien sisällä toisistaan. */
const AJON_RAKO_MS = 5 * 60 * 1000

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const tapahtumat: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("project_import_events")
      .select("source_name, detected_at")
      .gte("detected_at", "2026-08-25")
      .order("detected_at", { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    tapahtumat.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  console.log(`tuontitapahtumia 25.8. alkaen: ${tapahtumat.length}`)

  /* Ryhmittely: sama lähde + alle 5 min edellisestä = sama ajo. */
  const ajot = new Map<string, number[]>()
  const viimeisin = new Map<string, number>()
  for (const t of tapahtumat) {
    const nimi = String(t.source_name ?? "(tyhjä)")
    const aika = Date.parse(t.detected_at)
    const lista = ajot.get(nimi) ?? []
    const edellinen = viimeisin.get(nimi)
    if (edellinen === undefined || aika - edellinen > AJON_RAKO_MS) lista.push(0)
    lista[lista.length - 1] += 1
    ajot.set(nimi, lista)
    viimeisin.set(nimi, aika)
  }

  const kaikkiAjot = [...ajot.values()].flat()
  const jakauma = new Map<number, number>()
  for (const n of kaikkiAjot) jakauma.set(n, (jakauma.get(n) ?? 0) + 1)

  console.log(`\n=== ajoja yhteensä: ${kaikkiAjot.length} ===`)
  console.log("kandidaatteja/ajo   ajoja")
  for (const [n, c] of [...jakauma].sort((a, b) => a[0] - b[0])) {
    console.log(String(n).padStart(9), " ".repeat(8), String(c).padStart(5), n === 6 ? "  <-- rinnakkaisuuden raja" : "")
  }
  const kuusi = jakauma.get(6) ?? 0
  console.log(`\ntasan 6: ${kuusi} / ${kaikkiAjot.length} = ${((kuusi / kaikkiAjot.length) * 100).toFixed(0)} %`)
  console.log(`yli 6:   ${kaikkiAjot.filter((n) => n > 6).length}`)

  console.log("\n=== lähteet joilla eniten 6:n ajoja ===")
  const kuudet = [...ajot].map(([n, l]) => [n, l.filter((x) => x === 6).length, l.length] as const).filter((x) => x[1] > 0)
  for (const [n, k, y] of kuudet.sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(k).padStart(3)}/${String(y).padStart(3)} ajoa  ${n}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
