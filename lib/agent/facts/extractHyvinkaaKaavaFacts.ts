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

export function extractHyvinkaaKaavaFacts({
  documentId,
  sourceName,
  planName,
  planNumber,
  recordNumber,
  phase,
  planType,
  description,
  contacts,
  center,
}: {
  documentId: string
  sourceName: string
  planName: string | null
  planNumber: string | null
  recordNumber: string | null
  phase: string | null
  planType: string | null
  description: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
  center: { x: number; y: number } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(planName) ?? `Kaava ${planNumber ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "hyvinkaaKaavaParser",

    decision_index: planNumber ?? recordNumber ?? "hyvinkaa-kaava",

    plan_type: planType,
    record_number: clean(recordNumber),
    description: clean(description),
    contacts,
    coordinates: center,
  }

  if (planNumber) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "kaavatunnus",
      fact_value: planNumber,
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
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  return facts
}
