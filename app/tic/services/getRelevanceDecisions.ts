import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RelevanceDecision = {
  id: string
  created_at: string
  signal_id: string | null
  title: string | null
  source_name: string | null
  model: string | null
  llm_relevant: boolean | null
  llm_confidence: number | null
  llm_reason: string | null
  final_status: string | null
}

export type RelevanceDecisionsResult = {
  decisions: RelevanceDecision[]
  total: number
  surfaced: number
  ignored: number
}

/*
 * Lukee AI-relevanssiportin päätökset (llm_relevance_log) TIC-seurantaa varten.
 * Näin näet mitä automaattinen suodatus teki harmaan alueen signaaleille —
 * etenkin mitä se pudotti (ignored) ilman että se päätyi katselmointijonoosi.
 */
export async function getRelevanceDecisions(
  limit = 200
): Promise<RelevanceDecisionsResult> {
  const { data, error } = await supabaseAdmin
    .from("llm_relevance_log")
    .select(
      "id, created_at, signal_id, title, source_name, model, llm_relevant, llm_confidence, llm_reason, final_status"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const decisions = (data ?? []) as RelevanceDecision[]

  return {
    decisions,
    total: decisions.length,
    surfaced: decisions.filter((d) => d.final_status === "needs_review").length,
    ignored: decisions.filter((d) => d.final_status === "ignored").length,
  }
}
