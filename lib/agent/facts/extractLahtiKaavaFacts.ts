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

export function extractLahtiKaavaFacts({
  documentId,
  sourceName,
  title,
  kaavaTunnus,
  planType,
  vireilletulo,
  applicant,
  phase,
  description,
  contacts,
  center,
}: {
  documentId: string
  sourceName: string
  title: string | null
  kaavaTunnus: string | null
  planType: string | null
  vireilletulo: string | null
  applicant: string | null
  phase: string | null
  description: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
  center: { x: number; y: number } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? `Kaava ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "lahtiKaavaParser",

    decision_index: kaavaTunnus ?? title ?? "lahti-kaava",

    plan_type: clean(planType),
    vireilletulo: clean(vireilletulo),
    applicant: clean(applicant),
    description: clean(description),
    contacts,
    coordinates: center,
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
