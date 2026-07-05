import type { FactExtractor } from "../types"

export const permitExtractor: FactExtractor = ({ text }) => {
  const patterns = [
    /\bLP-\d{4}-\d+\b/gi,
    /\blupatunnus[:\s]+([A-Z0-9\-\/]+)/gi,
    /\brakennusluvan numero[:\s]+([A-Z0-9\-\/]+)/gi,
  ]

  const values = new Set<string>()

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      values.add(match[1] ?? match[0])
    }
  }

  return [...values].map((value) => ({
    fact_type: "permit_number",
    fact_key: "permit_number",
    fact_value: value.trim(),
    confidence: 0.95,
    metadata: {
      extractor: "permitExtractor",
    },
  }))
}