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

export function extractMikkeliKaavaFacts({
  documentId,
  sourceName,
  title,
  kaavaTunnus,
  phase,
  decisionNumber,
  description,
  contact,
}: {
  documentId: string
  sourceName: string
  title: string | null
  kaavaTunnus: string | null
  phase: string | null
  decisionNumber: string | null
  description: string | null
  contact: { name: string | null; title: string | null; phone: string | null; email: string | null } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? `Kaava ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "mikkeliKaavaParser",

    decision_index: kaavaTunnus ?? title ?? "mikkeli-kaava",

    decision_number: clean(decisionNumber),
    description: clean(description),
    contacts: contact && contact.name ? [contact] : [],
  }

  if (kaavaTunnus) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "kaavatunnus",
      fact_value: kaavaTunnus,
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
