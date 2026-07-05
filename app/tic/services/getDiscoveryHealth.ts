import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DiscoveryHealth = {
  sources: {
    total: number
    enabled: number
    disabled: number
  }
  documents: {
    total: number
    today: number
    pdf: number
    html: number
    api: number
  }
  jobs: {
    pending: number
    running: number
    success: number
    error: number
  }
  recentRuns: {
    id: string
    created_at: string
    agent_type: string
    source_name: string | null
    status: string
    documents_found: number | null
    documents_saved: number | null
    pdf_found: number | null
    pdf_saved: number | null
    duration_ms: number | null
    error_message: string | null
  }[]
}

export async function getDiscoveryHealth(): Promise<DiscoveryHealth> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    sourcesResult,
    documentsResult,
    todayDocumentsResult,
    pdfDocumentsResult,
    htmlDocumentsResult,
    apiDocumentsResult,
    pendingJobsResult,
    runningJobsResult,
    successJobsResult,
    errorJobsResult,
    recentRunsResult,
  ] = await Promise.all([
    supabaseAdmin.from("discovery_sources").select("id, enabled"),
    supabaseAdmin.from("source_documents").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabaseAdmin
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("document_type", "pdf"),
    supabaseAdmin
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("document_type", "html"),
    supabaseAdmin
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("document_type", "api"),
    supabaseAdmin
      .from("agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    supabaseAdmin
      .from("agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "success"),
    supabaseAdmin
      .from("agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
    supabaseAdmin
      .from("agent_runs")
      .select(`
        id,
        created_at,
        agent_type,
        source_name,
        status,
        documents_found,
        documents_saved,
        pdf_found,
        pdf_saved,
        duration_ms,
        error_message
      `)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const sourceRows = sourcesResult.data ?? []

  return {
    sources: {
      total: sourceRows.length,
      enabled: sourceRows.filter((source) => source.enabled).length,
      disabled: sourceRows.filter((source) => !source.enabled).length,
    },
    documents: {
      total: documentsResult.count ?? 0,
      today: todayDocumentsResult.count ?? 0,
      pdf: pdfDocumentsResult.count ?? 0,
      html: htmlDocumentsResult.count ?? 0,
      api: apiDocumentsResult.count ?? 0,
    },
    jobs: {
      pending: pendingJobsResult.count ?? 0,
      running: runningJobsResult.count ?? 0,
      success: successJobsResult.count ?? 0,
      error: errorJobsResult.count ?? 0,
    },
    recentRuns: (recentRunsResult.data ?? []) as DiscoveryHealth["recentRuns"],
  }
}