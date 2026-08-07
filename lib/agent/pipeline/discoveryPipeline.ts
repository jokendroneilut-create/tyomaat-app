import { createClient } from "@supabase/supabase-js"
import { runSourceWorker } from "@/lib/agent/workers/sourceWorker"
import { collectArticleDocument } from "@/lib/agent/discovery/collectors/articleCollector"
import { runPdfWorker } from "@/lib/agent/workers/pdfWorker"
import { runTextExtractionWorker } from "@/lib/agent/workers/textExtractionWorker"
import { runFactWorker } from "@/lib/agent/workers/factWorker"
import { runIdentityWorker } from "@/lib/agent/workers/identityWorker"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PipelineStage = "sources" | "articles" | "pdfs" | "texts" | "facts"

const ALL_STAGES: PipelineStage[] = [
  "sources",
  "articles",
  "pdfs",
  "texts",
  "facts",
]

type PipelineOptions = {
  maxSourceCount?: number
  maxArticleJobs?: number
  maxPdfJobs?: number
  maxTextJobs?: number
  maxFactJobs?: number
  maxIdentityCatchUpJobs?: number
  stages?: PipelineStage[]
}

/*
 * Koko putki (kaikki vaiheet peräkkäin samassa pyynnössä) ylittää helposti
 * Vercelin Hobby-tason 60s suoritusrajan, jolloin myöhemmät vaiheet
 * (faktat, tunnistus) eivät ehdi käynnistyä lainkaan — dokumentit jäävät
 * pysyvästi jonoon ilman ihmisen manuaalista väliintuloa. Siksi yöllinen
 * cron kutsuu tätä kahdessa erillisessä ajastetussa pyynnössä (ks.
 * vercel.json): ensin "sources+articles+pdfs+texts" (keräys), muutaman
 * minuutin päästä "facts" (käsittely) — kumpikin oma 60s-budjettinsa.
 * `stages`-parametri mahdollistaa tämän ilman että käsiajo (admin-paneeli)
 * menettää nykyisen "aja kaikki" -käytöksensä.
 */
export async function runDiscoveryPipeline(options: PipelineOptions = {}) {
  const startedAt = Date.now()

  const stages = new Set(options.stages ?? ALL_STAGES)

  const maxSourceCount = options.maxSourceCount ?? 10
  const maxArticleJobs = options.maxArticleJobs ?? 20
  const maxPdfJobs = options.maxPdfJobs ?? 20
  const maxTextJobs = options.maxTextJobs ?? 20
  const maxFactJobs = options.maxFactJobs ?? 20
  /*
   * Kiinniotto on pienempi kuin faktabudjetti: jono on normaalisti tyhjä,
   * joten tämä varaa vain pienen siivun 60s-budjetista eikä syö uusien
   * dokumenttien käsittelyä. Kertyneen jonon purkuun riittää muutama ajo.
   */
  const maxIdentityCatchUpJobs = options.maxIdentityCatchUpJobs ?? 5

  const sourceResults = []
  const articleResults = []
  const pdfResults = []
  const textResults = []
  const factResults = []
  const identityResults = []

  //
  // 1. Source Worker
  //
  if (stages.has("sources")) {
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from("discovery_sources")
      .select("*")
      .order("priority", { ascending: false })
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit(maxSourceCount)

    if (sourcesError) throw sourcesError

    for (const source of sources ?? []) {
      const result = await runSourceWorker(source.id)
      sourceResults.push(result)
    }
  }

  //
  // 2. Kerää HTML-artikkeleista PDF-linkit
  //
  for (let i = 0; stages.has("articles") && i < maxArticleJobs; i++) {
    const { data: document, error } = await supabaseAdmin
      .from("source_documents")
      .select("id")
      .eq("document_type", "html")
      .is("raw_payload->>articleFetchedAt", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!document) {
      articleResults.push({
        ok: true,
        message: "No HTML article documents waiting for collection",
      })
      break
    }

    const result = await collectArticleDocument(document.id)

articleResults.push(result)
  }

  //
  // 3. PDF Worker
  //
  for (let i = 0; stages.has("pdfs") && i < maxPdfJobs; i++) {
    const result = await runPdfWorker()
    pdfResults.push(result)

    if (result.message === "No pending PDF jobs") break
  }

  //
  // 4. Text Worker
  //
  for (let i = 0; stages.has("texts") && i < maxTextJobs; i++) {
    const result = await runTextExtractionWorker()
    textResults.push(result)

    if (result.message === "No PDF documents waiting for text extraction")
      break
  }

  //
  // 5a. Identity-jonon kiinniotto
  //
  /*
   * Tunnistus ajettiin aiemmin VAIN heti faktapoiminnan perässä samassa
   * silmukkakierroksessa. Jos kierros katkesi siihen väliin - aikaraja,
   * faktatyöläisen virhe, uudelleendeploy - dokumentille jäi
   * facts_extracted_at mutta ei identity_resolved_at, eikä mikään palannut
   * siihen koskaan: jonoa "faktat poimittu, tunnistus kesken" ei ollut
   * olemassa. Mitattu: 31 dokumenttia jumissa, vanhin 35 vuorokautta, ja
   * kahdella niistä oli oikeaa sisältöä (mm. 7800 k-m² kulttuurirakennus)
   * joka ei koskaan päätynyt ehdokkaaksi.
   *
   * Kiinniotto ajetaan ENNEN uusia faktoja, jotta jono purkautuu eikä
   * kasva ohi. Vanhin ensin.
   */
  for (let i = 0; stages.has("facts") && i < maxIdentityCatchUpJobs; i++) {
    const { data: pending } = await supabaseAdmin
      .from("source_documents")
      .select("id")
      .not("facts_extracted_at", "is", null)
      .is("identity_resolved_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!pending) break

    /*
     * Yksittäinen kaatuva dokumentti ei saa pysäyttää jonon purkua, mutta
     * se ei myöskään saa jäädä ikuiseen silmukkaan: virhetapauksessa
     * merkitään käsitellyksi ja jätetään jälki, jolloin seuraava kierros
     * siirtyy seuraavaan dokumenttiin.
     */
    try {
      identityResults.push(await runIdentityWorker(pending.id))
    } catch (error) {
      await supabaseAdmin
        .from("source_documents")
        .update({
          identity_resolved_at: new Date().toISOString(),
          error_message: `identity_catch_up: ${
            error instanceof Error ? error.message : String(error)
          }`,
        })
        .eq("id", pending.id)

      identityResults.push({
        ok: false,
        documentId: pending.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  //
  // 5b. Fact Worker + Identity Worker
  //
  for (let i = 0; stages.has("facts") && i < maxFactJobs; i++) {
    const result = await runFactWorker()
    factResults.push(result)

    if (result.message === "No documents waiting for fact extraction")
      break

    if (result.ok && result.documentId) {
      const identityResult = await runIdentityWorker(result.documentId)
      identityResults.push(identityResult)
    }
  }

  const durationMs = Date.now() - startedAt

  /*
   * Faktakäsittelyn jono ajon JÄLKEEN: montako dokumenttia odottaa yhä
   * faktapoimintaa. Lokitetaan per ajo, jotta Ajot-sivulta näkee purkautuuko
   * jono vai kasvaako se. (COUNT head-only, ei mukana kestomittauksessa.)
   */
  const { count: pendingFacts } = await supabaseAdmin
    .from("source_documents")
    .select("*", { count: "exact", head: true })
    .is("facts_extracted_at", null)

  /*
   * Sama mittari tunnistusjonolle. Ilman tätä jono oli näkymätön: mikään
   * sivu ei paljastanut 31:tä jumissa ollutta dokumenttia, koska niiden
   * status oli yhä "downloaded" kuten kaikilla muillakin.
   */
  const { count: pendingIdentity } = await supabaseAdmin
    .from("source_documents")
    .select("*", { count: "exact", head: true })
    .not("facts_extracted_at", "is", null)
    .is("identity_resolved_at", null)

  return {
    ok: true,
    durationMs,
    pendingFacts: pendingFacts ?? null,
    pendingIdentity: pendingIdentity ?? null,

    sourcesRun: sourceResults.length,
    articleRuns: articleResults.length,
    pdfRuns: pdfResults.length,
    textRuns: textResults.length,
    factRuns: factResults.length,
    identityRuns: identityResults.length,

    sourceResults,
    articleResults,
    pdfResults,
    textResults,
    factResults,
    identityResults,
  }
}