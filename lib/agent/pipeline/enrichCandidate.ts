import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CandidateInput = {
  candidateId: string
  signalId: string
  relevanceScore: number | null
}

export async function enrichCandidate({
  candidateId,
  signalId,
  relevanceScore,
}: CandidateInput) {
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from("candidate_projects")
    .select("*")
    .eq("id", candidateId)
    .single()

  if (candidateError) throw candidateError

  const nextScore = Math.max(
    Number(candidate.score ?? 0),
    Number(relevanceScore ?? 0)
  )

  const nextConfidence = Math.max(
    Number(candidate.confidence ?? 0),
    Number(relevanceScore ?? 0)
  )

  const { data: updatedCandidate, error: updateError } = await supabaseAdmin
    .from("candidate_projects")
    .update({
      updated_at: new Date().toISOString(),
      last_signal_at: new Date().toISOString(),
      signal_count: Number(candidate.signal_count ?? 0) + 1,
      score: nextScore,
      confidence: nextConfidence,
    })
    .eq("id", candidateId)
    .select()
    .single()

  if (updateError) throw updateError

  return {
    candidate: updatedCandidate,
    signalId,
    action: "candidate_enriched",
  }
}