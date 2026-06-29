import { sourceRules } from "../rules/sourceRules"

export type SourceScoreResult = {
  points: number
  reason: string
}

export function scoreSource(
  sourceName: string | null | undefined
): SourceScoreResult[] {
  if (!sourceName) {
    return []
  }

  const normalized = sourceName.toLowerCase()

  return sourceRules
    .filter(rule => normalized.includes(rule.source.toLowerCase()))
    .map(rule => ({
      points: rule.points,
      reason: rule.reason,
    }))
}