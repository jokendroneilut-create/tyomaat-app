import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DiscoveryAnalytics = {
  totals: {
    runs: number
    documentsFound: number
    documentsSaved: number
    pdfFound: number
    pdfSaved: number
    signalsFound: number
    candidatesCreated: number
  }
  byPeriod: {
    today: number
    last7Days: number
    last30Days: number
    last365Days: number
  }
  recentRuns: {
    id: string
    created_at: string
    source_name: string | null
    agent_type: string
    status: string
    documents_found: number | null
    documents_saved: number | null
    pdf_found: number | null
    pdf_saved: number | null
    signals_found: number | null
    candidates_created: number | null
    duration_ms: number | null
  }[]
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export async function getDiscoveryAnalytics(): Promise<DiscoveryAnalytics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: runs, error } = await supabaseAdmin
    .from("agent_runs")
    .select(`
      id,
      created_at,
      source_name,
      agent_type,
      status,
      documents_found,
      documents_saved,
      pdf_found,
      pdf_saved,
      signals_found,
      candidates_created,
      duration_ms
    `)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) throw error

  const rows = runs ?? []

  const sum = (key: keyof (typeof rows)[number]) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

  return {
    totals: {
      runs: rows.length,
      documentsFound: sum("documents_found"),
      documentsSaved: sum("documents_saved"),
      pdfFound: sum("pdf_found"),
      pdfSaved: sum("pdf_saved"),
      signalsFound: sum("signals_found"),
      candidatesCreated: sum("candidates_created"),
    },
    byPeriod: {
      today: rows.filter((row) => row.created_at >= today.toISOString()).length,
      last7Days: rows.filter((row) => row.created_at >= daysAgo(7)).length,
      last30Days: rows.filter((row) => row.created_at >= daysAgo(30)).length,
      last365Days: rows.filter((row) => row.created_at >= daysAgo(365)).length,
    },
    recentRuns: rows as DiscoveryAnalytics["recentRuns"],
  }
}