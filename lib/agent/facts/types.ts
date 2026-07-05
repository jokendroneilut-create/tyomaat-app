export type FactType =
  | "permit_number"
  | "property_id"
  | "address"
  | "municipality"
  | "applicant"
  | "developer"
  | "contractor"
  | "designer"
  | "building_type"
  | "project_stage"
  | "gross_floor_area"
  | "total_area"
  | "money"
  | "date"
  | "decision_date"

export type ExtractedFact = {
  fact_type: FactType
  fact_key?: string
  fact_value?: string
  fact_number?: number
  fact_date?: string
  confidence: number
  metadata?: Record<string, unknown>
}

export type FactExtractorInput = {
  documentId: string
  sourceName: string | null
  text: string
}

export type FactExtractor = (
  input: FactExtractorInput
) => ExtractedFact[]