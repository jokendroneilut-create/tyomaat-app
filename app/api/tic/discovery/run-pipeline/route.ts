import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runDiscoveryPipeline } from "@/lib/agent/pipeline/discoveryPipeline"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"
export const maxDuration = 500

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))

  const result = await runDiscoveryPipeline({
    maxSourceCount: body.maxSourceCount,
    maxArticleJobs: body.maxArticleJobs,
    maxPdfJobs: body.maxPdfJobs,
    maxTextJobs: body.maxTextJobs,
    maxFactJobs: body.maxFactJobs,
    stages: body.stages,
  })

  /*
   * Kokonaiskesto ei ollut talteenotettuna mihinkään - vain yksittäinen
   * koodikommentin mittaus oli olemassa. Ilman tätä ei voida arvioida
   * kuinka paljon liikkumavaraa maxDuration-kattoon oikeasti on, tai
   * riippuuko kesto siitä mitkä lähteet sattuivat sen yön erään
   * (ks. app/tic/operations - source_ids mahdollistaa tämän
   * korrelaation jälkikäteen).
   */
  const { error: logError } = await supabaseAdmin
    .from("discovery_pipeline_runs")
    .insert({
      duration_ms: result.durationMs,
      /*
       * Mihin vaiheeseen aikabudjetti loppui, null jos ajo ehti loppuun.
       * Ilman tätä lyhyt ajo näyttää samalta kuin tyhjä yö: 14 lähteen
       * sijaan viisi, eikä mikään kerro johtuiko se budjetista vai siitä
       * ettei lähteitä ollut ajettavana.
       */
      stopped_at: result.stoppedAt ?? null,
      pending_facts: result.pendingFacts ?? null,
      sources_run: result.sourcesRun,
      article_runs: result.articleRuns,
      pdf_runs: result.pdfRuns,
      text_runs: result.textRuns,
      fact_runs: result.factRuns,
      identity_runs: result.identityRuns,
      max_source_count: body.maxSourceCount ?? null,
      max_article_jobs: body.maxArticleJobs ?? null,
      max_pdf_jobs: body.maxPdfJobs ?? null,
      max_text_jobs: body.maxTextJobs ?? null,
      max_fact_jobs: body.maxFactJobs ?? null,
      source_ids: (result.sourceResults ?? [])
        .map((r: any) => r.sourceId ?? null)
        .filter(Boolean),
    })

  if (logError) console.error("discovery_pipeline_runs insert failed", logError)

  return NextResponse.json(result)
}