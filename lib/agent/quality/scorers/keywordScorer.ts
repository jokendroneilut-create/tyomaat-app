import type { CandidateQualityRule } from "../rules/candidateQualityRules"

export type ScoreResult = {
  points: number
  reason: string
}

export function scoreKeywords(
  text: string,
  rules: CandidateQualityRule[]
): ScoreResult[] {
  return rules
    .filter((rule) => text.includes(rule.keyword.toLowerCase()))
    .map((rule) => ({
      points: rule.points,
      reason: rule.reason,
    }))
}