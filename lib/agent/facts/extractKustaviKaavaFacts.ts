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

export function extractKustaviKaavaFacts({
  documentId,
  sourceName,
  title,
  phase,
  description,
}: {
  documentId: string
  sourceName: string
  title: string | null
  phase: string | null
  description: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? "Kustavin kaava"

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "kustaviKaavaParser",

    decision_index: title ?? "kustavi-kaava",

    description: clean(description),
    contacts: [],
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
