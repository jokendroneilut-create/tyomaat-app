import { createClient } from "@supabase/supabase-js"
import { calculateCandidateQuality } from "../quality"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CandidateInput = {
  candidateId: string
  signalId: string
  relevanceScore: number | null
  sourceName: string | null
}

export async function enrichCandidate({
  candidateId,
  signalId,
  relevanceScore,
  sourceName,
}: CandidateInput) {
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from("candidate_projects")
    .select("*")
    .eq("id", candidateId)
    .single()

  if (candidateError) throw candidateError

  const nextSignalCount = Number(candidate.signal_count ?? 0) + 1

  const nextScore = Math.max(
    Number(candidate.score ?? 0),
    Number(relevanceScore ?? 0)
  )

  const nextConfidence = Math.max(
    Number(candidate.confidence ?? 0),
    Number(relevanceScore ?? 0)
  )

  const extractedEntities = candidate.candidate_entities ?? {}

  const quality = calculateCandidateQuality({
    title: candidate.title,
    summary: candidate.summary,
    reason: candidate.reason,
    candidate_type: candidate.candidate_type,
    city: candidate.city,
    source_name: sourceName,
    entities: extractedEntities,
    signal_count: nextSignalCount,
    source_count: candidate.source_count,
  })

  const { data: updatedCandidate, error: updateError } = await supabaseAdmin
    .from("candidate_projects")
    .update({
      updated_at: new Date().toISOString(),
      last_signal_at: new Date().toISOString(),
      signal_count: nextSignalCount,
      score: nextScore,
      confidence: nextConfidence,
      candidate_quality: quality.quality,
      candidate_quality_reason: quality.reason,
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