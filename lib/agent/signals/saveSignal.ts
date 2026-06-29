import { createClient } from "@supabase/supabase-js"
import type { Signal } from "../pipeline/types"
import { classifySignal } from "../pipeline/classifySignal"
import { linkSignalToCandidate } from "../pipeline/linkSignalToCandidate"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function saveSignal(signal: Signal) {
  const sourceName =
    signal.raw && typeof signal.raw === "object" && "sourceName" in signal.raw
      ? String(signal.raw.sourceName)
      : "unknown"

  if (signal.externalId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("project_signals")
      .select("id")
      .eq("source_name", sourceName)
      .eq("external_id", signal.externalId)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      return {
        ...existing,
        skipped: true,
        reason: "duplicate_signal",
      }
    }
  }

  const classification = classifySignal(signal)

  const { data, error } = await supabaseAdmin
    .from("project_signals")
    .insert({
      source_name: sourceName,
      source_url: signal.sourceUrl,
      external_id: signal.externalId ?? null,
      signal_type: signal.type,
      title: signal.title,
      description: signal.description ?? null,
      city: signal.city ?? null,
      location: signal.location ?? null,

      normalized_signal_type: classification.normalizedSignalType,
      relevance_score: classification.relevanceScore,
      classification_reason: classification.reason,
      classified_at: new Date().toISOString(),

      review_status: classification.reviewStatus,
      review_reason: classification.reason,

      raw_payload: signal.raw,
      processed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  if (classification.reviewStatus !== "ignored") {
    await linkSignalToCandidate({
      id: data.id,
      title: data.title,
      city: data.city,
      location: data.location,
      source_name: data.source_name,
      normalized_signal_type: data.normalized_signal_type,
      relevance_score: data.relevance_score,
      classification_reason: data.classification_reason,
    })
  }

  return {
    ...data,
    skipped: false,
  }
}