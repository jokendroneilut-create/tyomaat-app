/*
 * Kerää uudelleen ne kaavalähteet joiden kuvaus poimittiin aiemmin vain
 * ensimmäisestä kappaleesta, ja ajaa muuttuneet dokumentit putken läpi.
 *
 * TAUSTA. Kirkkonummen "Energiakuja" oli meillä 17.7.2026 lähtien, mutta
 * tallennettu kuvaus katkesi ennen kohtaa jossa lukee että alueelle
 * toteutetaan Microsoft 3465 Oy:n datakeskuskokonaisuus. Hanke löytyi
 * meiltä vasta 11.8.2026 YVA-lähteen kautta - kuukautta myöhemmin ja
 * eri nimellä, joten samasta hankkeesta syntyi kaksi riviä.
 *
 * FAKTALIPUT ON NOLLATTAVA. factWorker poimii vain dokumentteja joilla
 * facts_extracted_at on null. Pelkkä uudelleenkeräys päivittäisi siis
 * source_documents-rivin mutta ei koskaan etenisi projects-tauluun asti.
 *
 * VAIN MUUTTUNEET NOLLATAAN. Suurin osa sivuista on yhden kappaleen
 * mittaisia eikä niiden kuvaus muutu lainkaan; niiden ajaminen putken
 * lapi olisi turhaa tyota ja turhaa kirjoitusta.
 *
 *   npx tsx scripts/recollect-descriptions.ts
 *   npx tsx scripts/recollect-descriptions.ts --apply
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

const PARSERS = [
  "kirkkonummiKaavaParser",
  "seinajokiKaavaParser",
  "savonlinnaKaavaParser",
  "lappeenrantaKaavaParser",
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { runSourceWorker } = await import("../lib/agent/workers/sourceWorker")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: sources, error } = await supabase
    .from("discovery_sources")
    .select("id, name, parser")
    .in("parser", PARSERS)
  if (error) throw error

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${sources?.length ?? 0} lahdetta\n`
  )
  for (const s of sources ?? []) console.log(`  ${s.parser.padEnd(26)} ${s.name}`)

  const sourceIds = (sources ?? []).map((s) => s.id)
  if (!sourceIds.length) return

  const before = new Map<string, string | null>()
  for (const id of sourceIds) {
    const { data } = await supabase
      .from("source_documents")
      .select("document_url, raw_payload")
      .eq("source_id", id)
    for (const d of data ?? []) before.set(d.document_url, d.raw_payload?.description ?? null)
  }
  console.log(`\n  dokumentteja ennen: ${before.size}`)

  if (!APPLY) {
    console.log("\n(kuivaharjoittelu ei kerää uudelleen — --apply ajaa keräyksen)")
    return
  }

  for (const s of sources ?? []) {
    process.stdout.write(`\n  keraan ${s.name} ... `)
    const result = await runSourceWorker(s.id)
    console.log(JSON.stringify(result).slice(0, 160))
  }

  const changed: string[] = []
  for (const id of sourceIds) {
    const { data } = await supabase
      .from("source_documents")
      .select("id, document_url, title, raw_payload")
      .eq("source_id", id)
    for (const d of data ?? []) {
      const now = d.raw_payload?.description ?? null
      if (now !== before.get(d.document_url)) changed.push(d.id)
    }
  }

  console.log(`\n  kuvaus muuttui: ${changed.length} dokumentissa`)

  /*
   * Putken ajo ei saa riippua siitä muuttuiko kuvaus TÄLLÄ kierroksella:
   * aiempi keskeytynyt ajo on voinut jo nollata faktaliput mutta jäädä
   * ennen käsittelyä, jolloin dokumentit jäisivät pysyvästi jonoon.
   */
  let reset = 0
  for (let i = 0; i < changed.length; i += 50) {
    const { error: e } = await supabase
      .from("source_documents")
      .update({ facts_extracted_at: null, identity_resolved_at: null })
      .in("id", changed.slice(i, i + 50))
    if (e) console.log(`  VIRHE nollaus: ${e.message}`)
    else reset += changed.slice(i, i + 50).length
  }
  console.log(`  faktaliput nollattu: ${reset}`)

  /*
   * Putki ajetaan silmukassa: yksi kutsu käsittelee vain budjetin verran
   * dokumentteja (60s Vercel-rajan takia), joten 42 dokumentin jono ei
   * purkaudu yhdellä kutsulla. Kierrosraja on turvaraja sen varalta että
   * jokin dokumentti jää jumiin eikä laskuri koskaan laske nollaan.
   */
  const { runDiscoveryPipeline } = await import("../lib/agent/pipeline/discoveryPipeline")

  const remaining = async () => {
    const { count } = await supabase
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .in("source_id", sourceIds)
      .is("facts_extracted_at", null)
    return count ?? 0
  }

  console.log("")
  for (let round = 1; round <= 30; round++) {
    const left = await remaining()
    if (left === 0) {
      console.log(`  jono purettu (${round - 1} kierrosta)`)
      break
    }
    process.stdout.write(`  kierros ${round}: jonossa ${left} ... `)
    await runDiscoveryPipeline({
      stages: ["facts"],
      maxFactJobs: 25,
      maxIdentityCatchUpJobs: 25,
    })
    console.log("ok")
  }

  const left = await remaining()
  if (left > 0) console.log(`  HUOM: ${left} dokumenttia jai kasittelematta`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
