import type { FactExtractor, ExtractedFact } from "../types"
import { areaExtractor } from "./areaExtractor"
import { permitExtractor } from "./permitExtractor"

function normalizeDash(value: string) {
  return value.replace(/[–—]/g, "-").trim()
}

export const buildingPermitExtractor: FactExtractor = (input) => {
  const facts: ExtractedFact[] = []

  facts.push(...permitExtractor(input))
  facts.push(...areaExtractor(input))

  const lines = input.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeDash(lines[i])

    const propertyMatch = line.match(/\b(\d{1,3}-\d{1,4}-\d{1,4}-\d{1,4})\b/)

    if (propertyMatch) {
      const propertyId = propertyMatch[1]

      facts.push({
        fact_type: "property_id",
        fact_key: "property_id",
        fact_value: propertyId,
        confidence: 0.98,
        metadata: {
          extractor: "buildingPermitExtractor",
          originalLine: lines[i],
        },
      })

      const streetLine = lines[i + 1]
      const postalLine = lines[i + 2]

      if (streetLine && postalLine && /\d{5}\s+\S+/i.test(postalLine)) {
        facts.push({
          fact_type: "address",
          fact_key: "address",
          fact_value: `${streetLine}, ${postalLine}`,
          confidence: 0.9,
          metadata: {
            extractor: "buildingPermitExtractor",
            propertyId,
          },
        })
      }
    }
  }

  return facts
}