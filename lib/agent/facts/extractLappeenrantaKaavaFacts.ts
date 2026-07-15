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

export function extractLappeenrantaKaavaFacts({
  documentId,
  sourceName,
  title,
  documentUrl,
  phase,
  description,
  contacts,
  center,
}: {
  documentId: string
  sourceName: string
  title: string | null
  documentUrl: string
  phase: string | null
  description: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
  center: { x: number; y: number } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? "Lappeenrannan kaava"

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "lappeenrantaKaavaParser",

    decision_index: documentUrl,

    description: clean(description),
    contacts,
    coordinates: center,
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
