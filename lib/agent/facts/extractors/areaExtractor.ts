import type { FactExtractor } from "../types"

export const areaExtractor: FactExtractor = ({ text }) => {
  const matches =
    text.match(/\d+(?:[.,]\d+)?\s?(?:m²|m2|kem²|k-m²|k-m2)/gi) ?? []

  return [...new Set(matches)].map((value) => {
    const numericValue = Number(
      value
        .replace(",", ".")
        .replace(/[^\d.]/g, "")
    )

    return {
      fact_type: "gross_floor_area",
      fact_key: "area",
      fact_value: value,
      fact_number: Number.isFinite(numericValue) ? numericValue : undefined,
      confidence: 0.9,
      metadata: {
        extractor: "areaExtractor",
      },
    }
  })
}