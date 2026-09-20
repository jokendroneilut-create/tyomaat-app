/*
 * MIHIN CASEM-KUNNAN LAHDEAJON AIKA MENEE?
 *
 * Lahdeajolla on kova 90 sekunnin katkaisu (`sourceWorker`), ja kun se
 * ylittyy, virheviesti kertoo vain etta se ylittyi - ei mika vaihe sen soi.
 * Tama skripti pilkkoo ajon vaiheisiin ja laskee pyynnot, jotta korjausta ei
 * tarvitse arvata. Mitattu 20.9.2026: ilmeinen epailty (hidas lahdepalvelin)
 * ei ollut syy, vaan budjetiton tasmaytyslistan lataus haun jalkeen (D-206).
 *
 * EI KIRJOITA MITAAN. Haku ja luvut ovat SELECT-puolta; tuontia ei ajeta,
 * joten mallikutsuista mitataan vain kesto.
 *
 *   npx tsx scripts/diag-casem-ajon-aika.ts [rovaniemi|tampere|pori|jyvaskyla]
 */
import { readFileSync } from "node:fs"

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

const host = process.argv[2] ?? "rovaniemi"

/*
 * Pyynnot kaarrataan globaalin fetchin kautta, koska kerain ei raportoi
 * niita itse. Vain lahteen oma verkkotunnus lasketaan - Supabase-liikenne
 * kulkee samasta funktiosta.
 */
type Req = { url: string; ms: number; ok: boolean }
const reqs: Req[] = []
const realFetch = globalThis.fetch

globalThis.fetch = (async (url: any, init: any) => {
  const u = String(url)
  if (!u.includes("cloudnc.fi")) return realFetch(url, init)
  const t = Date.now()
  try {
    const r = await realFetch(url, init)
    reqs.push({ url: u, ms: Date.now() - t, ok: r.ok })
    return r
  } catch (error) {
    reqs.push({ url: u, ms: Date.now() - t, ok: false })
    throw error
  }
}) as any

const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const summa = (xs: Req[]) => xs.reduce((a, b) => a + b.ms, 0)

async function main() {
  const casem = await import("@/lib/agent/fetchCaseMSource")
  const ic = await import("@/lib/agent/importCandidate")
  const { scoreRelevance } = await import("@/lib/agent/quality/scorers/llmRelevanceScorer")
  const { scoreBuildingType } = await import("@/lib/agent/quality/scorers/llmBuildingTypeScorer")

  const fetchers: Record<string, () => Promise<any[]>> = {
    rovaniemi: casem.fetchRovaniemiPaatoksetSource,
    tampere: casem.fetchTamperePaatoksetSource,
    pori: casem.fetchPoriPaatoksetSource,
    jyvaskyla: casem.fetchJyvaskylaPaatoksetSource,
  }

  const fetcher = fetchers[host]
  if (!fetcher) {
    console.error(`Tuntematon kunta: ${host}. Vaihtoehdot: ${Object.keys(fetchers).join(", ")}`)
    process.exit(1)
  }

  /*
   * Tasmaytyslista on 15 minuutin valimuistin takana. Se tyhjennetaan, koska
   * mitattava tapaus on nimenomaan KYLMA lataus - se on se joka osuu
   * putkiajon ensimmaiseen lahteeseen.
   */
  ic.clearProjectsForMatchingCache()

  // --- Vaihe 1: haku ---
  const t0 = Date.now()
  const candidates = await fetcher()
  const tHaku = Date.now() - t0

  const haku = reqs.filter((r) => r.url.includes("/haku?"))
  const detail = reqs.filter((r) => !r.url.includes("/haku?"))

  console.log(`\n=== ${host}: HAKU ===`)
  console.log(`kesto             : ${s(tHaku)}   (oma budjetti 55 s)`)
  console.log(`kandidaatteja     : ${candidates.length}`)
  console.log(`pyyntoja          : ${reqs.length}  (${s(summa(reqs))})`)
  console.log(`  hakusivuja      : ${haku.length}  (${s(summa(haku))})`)
  console.log(`  yksityiskohtia  : ${detail.length}  (${s(summa(detail))})  katto 60`)
  console.log(`epaonnistuneita   : ${reqs.filter((r) => !r.ok).length}`)
  console.log(`hitain pyynto     : ${Math.max(0, ...reqs.map((r) => r.ms))} ms`)

  // --- Vaihe 2: tuontia edeltava esityo ---
  const t1 = Date.now()
  const projects = await ic.loadProjectsForMatching()
  const tProjects = Date.now() - t1

  const t2 = Date.now()
  const seen = await ic.findRecentlySeenSourceUrls(
    candidates.map((c: any) => c?.source_url)
  )
  const tSeen = Date.now() - t2

  const unseen = candidates.filter(
    (c: any) => c?.source_url && !seen.has(c.source_url)
  )

  console.log(`\n=== ${host}: ESITYO ===`)
  console.log(`tasmaytyslista    : ${s(tProjects)}  (${projects.length} hanketta, kylma)`)
  console.log(`jo nahdyt         : ${s(tSeen)}`)
  console.log(`uusia tuotavia    : ${unseen.length} / ${candidates.length}`)

  // --- Vaihe 3: mita yksi uusi ehdokas maksaa ---
  const OTOS = Math.min(10, unseen.length)
  const kestot: number[] = []

  for (const c of unseen.slice(0, OTOS)) {
    const tr = Date.now()
    await scoreRelevance({
      title: c.name,
      description: c.description,
      sourceName: c.source_name,
    })
    const tRel = Date.now() - tr

    /* Kohdetyyppi on kaksi kutsua rinnakkain (kahden aanen portti). */
    const tb = Date.now()
    await Promise.all([
      scoreBuildingType({ title: c.name, description: c.description }),
      scoreBuildingType({ title: c.name, description: c.description }),
    ])
    kestot.push(tRel + (Date.now() - tb))
  }

  const ka = kestot.length ? kestot.reduce((a, b) => a + b, 0) / kestot.length : 0
  const CONCURRENCY = 6
  const aallot = Math.ceil(unseen.length / CONCURRENCY)
  const tTuonti = aallot * ka

  console.log(`\n=== ${host}: TUONTI (otos ${OTOS}) ===`)
  console.log(`mallikutsut/ehdokas: ${s(ka)}  (hitain ${s(Math.max(0, ...kestot))})`)
  console.log(`arvio tuonnille   : ${aallot} aaltoa x ${s(ka)} = ${s(tTuonti)}`)

  // --- Yhteenveto suhteessa kattoon ---
  const yht = tHaku + tProjects + tSeen + tTuonti
  console.log(`\n=== ${host}: YHTEENSA ===`)
  console.log(`haku ${s(tHaku)} + esityo ${s(tProjects + tSeen)} + tuonti ~${s(tTuonti)} = ~${s(yht)}`)
  console.log(`kova katkaisu 90 s -> ${yht > 90_000 ? "YLITTYY" : `marginaali ${s(90_000 - yht)}`}`)
  console.log(
    `\nHuom: arvio ei sisalla tuonnin tietokantakirjoituksia, joten toteuma\n` +
      `on tata suurempi. Vertaa discovery_runs-taulun kestoihin.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
