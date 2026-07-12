import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeLegacyPhase } from "./phases"

export type PhaseChangeSource = "agent_import" | "tic_approve" | "dashboard_admin"

export async function recordPhaseChange(input: {
  supabase: SupabaseClient
  projectId: string
  newPhase: string | null | undefined
  previousPhase: string | null | undefined
  source: PhaseChangeSource
  sourceName?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}) {
  const newKey = normalizeLegacyPhase(input.newPhase) ?? input.newPhase ?? null
  const prevKey =
    normalizeLegacyPhase(input.previousPhase) ?? input.previousPhase ?? null

  if (!newKey || newKey === prevKey) return null

  const { error } = await input.supabase.from("project_phase_history").insert({
    project_id: input.projectId,
    phase: newKey,
    previous_phase: prevKey,
    source: input.source,
    source_name: input.sourceName ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) console.error("recordPhaseChange insert failed", error)

  return { newKey, prevKey }
}
