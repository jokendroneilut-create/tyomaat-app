import { projectStages } from "@/lib/agent/knowledge/projectStages"
import type { PhaseKey } from "./phases"

/*
 * lib/agent/knowledge/projectStages.ts stays untouched — it also feeds
 * lib/agent/entities/extractEntities.ts -> lib/agent/quality/scorers/entityScorer.ts
 * in the discovery candidate-quality pipeline. Its `stage` values already
 * match valid PhaseKey slugs, so this file only reads it.
 */

export function inferPhaseFromText(
  name?: string | null,
  description?: string | null,
  metadata?: Record<string, unknown> | null
): PhaseKey | null {
  const text = [
    name,
    description,
    (metadata as any)?.operation,
    (metadata as any)?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (!text) return null

  const match = projectStages.find((entry) => text.includes(entry.keyword))

  return (match?.stage as PhaseKey) ?? null
}
