import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type PipelineRun = {
  id: string
  created_at: string
  duration_ms: number
  sources_run: number
  article_runs: number
  pdf_runs: number
  text_runs: number
  fact_runs: number
  identity_runs: number
  max_source_count: number | null
  source_ids: string[]
}

export async function getRecentPipelineRuns(limit = 30): Promise<PipelineRun[]> {
  const { data, error } = await supabaseAdmin
    .from("discovery_pipeline_runs")
    .select(
      "id, created_at, duration_ms, sources_run, article_runs, pdf_runs, text_runs, fact_runs, identity_runs, max_source_count, source_ids"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    /*
     * Taulu on tuore (käyttäjä ajoi luontiskriptin juuri) - jos sitä
     * ei vielä ole, näytetään tyhjä lista virheen kaatamisen sijaan.
     */
    if (error.code === "42P01") return []
    throw error
  }

  return data ?? []
}
