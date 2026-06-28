import { createClient } from "@supabase/supabase-js"
import type { Candidate } from "../types/candidate"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type CandidateSignal = {
  id: string
  created_at: string
  title: string
  source_name: string | null
  source_url: string | null
  normalized_signal_type: string | null
  relevance_score: number | null
  review_status: string | null
  classification_reason: string | null
}

export type CandidateDetail = {
  candidate: Candidate
  signals: CandidateSignal[]
}

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from("candidate_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (candidateError) {
    throw candidateError
  }

  if (!candidate) {
    return null
  }

  const { data: signals, error: signalsError } = await supabaseAdmin
    .from("project_signals")
    .select(`
      id,
      created_at,
      title,
      source_name,
      source_url,
      normalized_signal_type,
      relevance_score,
      review_status,
      classification_reason
    `)
    .eq("candidate_project_id", id)
    .order("created_at", { ascending: false })

  if (signalsError) {
    throw signalsError
  }

  return {
    candidate: candidate as Candidate,
    signals: (signals ?? []) as CandidateSignal[],
  }
}