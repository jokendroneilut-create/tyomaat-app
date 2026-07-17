export type ExtractedFact = {
  fact_type: string
  fact_key?: string | null
  fact_value?: string | null
  fact_number?: number | null
  fact_date?: string | null
  confidence: number
  metadata?: Record<string, any>
}

function clean(value: unknown) {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function extractTuusulaKaavaFacts({
  documentId,
  sourceName,
  planName,
  recordNumber,
  phase,
  description,
  contact,
  center,
}: {
  documentId: string
  sourceName: string
  planName: string | null
  recordNumber: string | null
  phase: string | null
  description: string | null
  contact: string | null
  center: { x: number; y: number } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(planName) ?? `Kaava ${recordNumber ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "tuusulaKaavaParser",

    decision_index: recordNumber ?? planName ?? "tuusula-kaava",

    record_number: clean(recordNumber),
    description: clean(description),
    contact: clean(contact),
    coordinates: center,
  }

  if (recordNumber) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "record_number",
      fact_value: recordNumber,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (operation) {
    facts.push({
      fact_type: "operation",
      fact_key: "plan_title",
      fact_value: operation,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (phase) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "field_phase",
      fact_value: phase,
      confidence: 0.85,
      metadata: commonMetadata,
    })
  }

  return facts
}
