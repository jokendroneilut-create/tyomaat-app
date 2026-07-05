import { createClient } from "@supabase/supabase-js"
import { runSourceWorker } from "@/lib/agent/workers/sourceWorker"
import { runPdfWorker } from "@/lib/agent/workers/pdfWorker"
import { runTextExtractionWorker } from "@/lib/agent/workers/textExtractionWorker"
import { runFactWorker } from "@/lib/agent/workers/factWorker"
import { runIdentityWorker } from "@/lib/agent/workers/identityWorker"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PipelineOptions = {
  maxSourceCount?: number
  maxPdfJobs?: number
  maxTextJobs?: number
  maxFactJobs?: number
}

export async function runDiscoveryPipeline(options: PipelineOptions = {}) {
  const startedAt = Date.now()

  const maxSourceCount = options.maxSourceCount ?? 10
  const maxPdfJobs = options.maxPdfJobs ?? 20
  const maxTextJobs = options.maxTextJobs ?? 20
  const maxFactJobs = options.maxFactJobs ?? 20

  const sourceResults = []
  const pdfResults = []
  const textResults = []
  const factResults = []
  const identityResults = []

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

  for (let i = 0; i < maxPdfJobs; i++) {
    const result = await runPdfWorker()
    pdfResults.push(result)

    if (result.message === "No pending PDF jobs") break
  }

  for (let i = 0; i < maxTextJobs; i++) {
    const result = await runTextExtractionWorker()
    textResults.push(result)

    if (result.message === "No PDF documents waiting for text extraction") break
  }

  for (let i = 0; i < maxFactJobs; i++) {
    const result = await runFactWorker()
    factResults.push(result)

    if (result.message === "No documents waiting for fact extraction") break

    if (result.ok && result.documentId) {
      const identityResult = await runIdentityWorker(result.documentId)
      identityResults.push(identityResult)
    }
  }

  const durationMs = Date.now() - startedAt

  return {
    ok: true,
    durationMs,
    sourcesRun: sourceResults.length,
    pdfRuns: pdfResults.length,
    textRuns: textResults.length,
    factRuns: factResults.length,
    identityRuns: identityResults.length,
    sourceResults,
    pdfResults,
    textResults,
    factResults,
    identityResults,
  }
}