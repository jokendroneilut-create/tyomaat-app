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

export function extractUusikaupunkiKaavaFacts({
  documentId,
  sourceName,
  title,
  kaavaTunnus,
  phase,
  description,
  contacts,
}: {
  documentId: string
  sourceName: string
  title: string | null
  kaavaTunnus: string | null
  phase: string | null
  description: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? `Uudenkaupungin kaava ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "uusikaupunkiKaavaParser",

    decision_index: kaavaTunnus ?? title ?? "uusikaupunki-kaava",

    description: clean(description),
    contacts,
  }

  if (kaavaTunnus) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "kaava_tunnus",
      fact_value: kaavaTunnus,
      confidence: 0.9,
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
