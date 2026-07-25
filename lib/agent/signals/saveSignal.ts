import { createClient } from "@supabase/supabase-js"
import type { Signal } from "../pipeline/types"
import { classifySignal } from "../pipeline/classifySignal"
import { linkSignalToCandidate } from "../pipeline/linkSignalToCandidate"
import {
  scoreRelevance,
  isRelevanceScorerEnabled,
} from "../quality/scorers/llmRelevanceScorer"
import { logRelevanceDecision } from "../quality/logRelevanceDecision"

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

  let classification = classifySignal(signal)

  /*
   * Harmaan alueen LLM-tarkennus: säännöt hoitavat selkeät tapaukset; vain
   * epävarma "unclassified" (pistemäärä 30, päätyisi turhaan manuaaliseen
   * katselmointiin) ohjataan Claudelle. Vain jos ANTHROPIC_API_KEY on asetettu.
   * Fail-open: scoreRelevance palauttaa null virheessä -> pysytään säännöissä.
   */
  let relevanceVerdict: Awaited<ReturnType<typeof scoreRelevance>> = null
  if (
    classification.normalizedSignalType === "unclassified" &&
    isRelevanceScorerEnabled()
  ) {
    relevanceVerdict = await scoreRelevance({
      title: signal.title,
      description: signal.description,
      sourceName,
    })

    if (relevanceVerdict) {
      const surface =
        relevanceVerdict.relevant && relevanceVerdict.confidence >= 0.6
      classification = {
        ...classification,
        relevanceScore: Math.round(relevanceVerdict.confidence * 100),
        reviewStatus: surface ? "needs_review" : "ignored",
        reason: `LLM: ${relevanceVerdict.reason}`,
      }
    }
  }

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

  if (relevanceVerdict) {
    await logRelevanceDecision({
      signalId: data.id,
      title: signal.title,
      description: signal.description,
      sourceName,
      ruleScore: 30,
      ruleStatus: "needs_review",
      model: relevanceVerdict.model,
      llmRelevant: relevanceVerdict.relevant,
      llmConfidence: relevanceVerdict.confidence,
      llmReason: relevanceVerdict.reason,
      finalStatus: classification.reviewStatus,
    })
  }

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