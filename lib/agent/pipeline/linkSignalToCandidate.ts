import { createClient } from "@supabase/supabase-js"
import { enrichCandidate } from "./enrichCandidate"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ProjectSignal = {
  id: string
  title: string
  city: string | null
  location: string | null
  normalized_signal_type: string | null
  relevance_score: number | null
  classification_reason: string | null
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

export async function linkSignalToCandidate(signal: ProjectSignal) {
  const normalizedTitle = normalizeTitle(signal.title)
  const titleWords = normalizedTitle
    .split(" ")
    .filter((word) => word.length >= 5)
    .slice(0, 5)

  let existingCandidate = null

  if (signal.city && titleWords.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("candidate_projects")
      .select("*")
      .eq("city", signal.city)
      .eq("status", "open")
      .ilike("title", `%${titleWords[0]}%`)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    existingCandidate = data
  }

  if (existingCandidate) {
    const { error: signalUpdateError } = await supabaseAdmin
      .from("project_signals")
      .update({
        candidate_project_id: existingCandidate.id,
      })
      .eq("id", signal.id)

    if (signalUpdateError) throw signalUpdateError

    const enriched = await enrichCandidate({
      candidateId: existingCandidate.id,
      signalId: signal.id,
      relevanceScore: signal.relevance_score,
    })

    return {
      action: "linked_existing",
      candidate: enriched.candidate,
    }
  }

  const { data: newCandidate, error: insertError } = await supabaseAdmin
    .from("candidate_projects")
    .insert({
      title: signal.title,
      city: signal.city,
      location: signal.location,
      candidate_type: signal.normalized_signal_type,
      confidence: signal.relevance_score,
      score: signal.relevance_score,
      signal_count: 1,
      source_count: 1,
      status: "open",
      review_status: "needs_review",
      summary: signal.title,
      reason: signal.classification_reason,
      last_signal_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) throw insertError

  const { error: signalUpdateError } = await supabaseAdmin
    .from("project_signals")
    .update({
      candidate_project_id: newCandidate.id,
    })
    .eq("id", signal.id)

  if (signalUpdateError) throw signalUpdateError

  return {
    action: "created_new",
    candidate: newCandidate,
  }
}