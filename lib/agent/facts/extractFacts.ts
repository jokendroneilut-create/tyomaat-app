import { buildingPermitExtractor } from "./extractors/buildingPermitExtractor"

import type {
  ExtractedFact,
  FactExtractor,
  FactExtractorInput,
} from "./types"

const extractors: FactExtractor[] = [
  buildingPermitExtractor,
]

export function extractFacts(input: FactExtractorInput): ExtractedFact[] {
  const results: ExtractedFact[] = []

  for (const extractor of extractors) {
    const facts = extractor(input)
    results.push(...facts)
  }

  return deduplicateFacts(results)
}

function deduplicateFacts(facts: ExtractedFact[]) {
  const seen = new Set<string>()

  return facts.filter((fact) => {
    const key = [
      fact.fact_type,
      fact.fact_key ?? "",
      fact.fact_value ?? "",
      fact.fact_number ?? "",
      fact.fact_date ?? "",
    ].join(":")

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}