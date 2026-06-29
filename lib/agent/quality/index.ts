import {
  negativeCandidateQualityRules,
  positiveCandidateQualityRules,
} from "./rules/candidateQualityRules"
import { scoreKeywords } from "./scorers/keywordScorer"
import { scoreSource } from "./scorers/sourceScorer"
import { scoreEntities } from "./scorers/entityScorer"

export type CandidateQualityInput = {
  title: string
  summary?: string | null
  reason?: string | null
  candidate_type?: string | null
  city?: string | null
  source_name?: string | null
  signal_count?: number | null
  source_count?: number | null
  entities?: {
    buildingTypes?: string[]
    projectStages?: string[]
  } | null
}

export type CandidateQualityResult = {
  quality: number
  reason: string
}

function scoreSignalStrength(input: CandidateQualityInput) {
  const results = []

  if ((input.signal_count ?? 0) >= 2) {
    results.push({
      points: 10,
      reason: "Useampi signaali samasta hankkeesta",
    })
  }

  if ((input.source_count ?? 0) >= 2) {
    results.push({
      points: 15,
      reason: "Useampi lähde tukee havaintoa",
    })
  }

  return results
}

export function calculateCandidateQuality(
  input: CandidateQualityInput
): CandidateQualityResult {
  const text = [
    input.title,
    input.summary,
    input.reason,
    input.candidate_type,
    input.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const ruleResults = [
    ...scoreKeywords(text, positiveCandidateQualityRules),
    ...scoreKeywords(text, negativeCandidateQualityRules),
    ...scoreSource(input.source_name),
    ...scoreEntities(input.entities),
    ...scoreSignalStrength(input),
  ]

  const rawQuality = ruleResults.reduce((sum, rule) => sum + rule.points, 0)
  const quality = Math.max(0, Math.min(100, rawQuality))

  const reason =
    ruleResults.length > 0
      ? ruleResults
          .map(
            (rule) =>
              `${rule.points > 0 ? "+" : ""}${rule.points}: ${rule.reason}`
          )
          .join("; ")
      : "Ei laatupisteisiin vaikuttavia sääntöosumia"

  return {
    quality,
    reason,
  }
}