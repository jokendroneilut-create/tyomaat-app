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

export function extractEspooKaavaFacts({
  documentId,
  sourceName,
  title,
  kaavaTunnus,
  phase,
  planType,
  description,
  area,
  changeApplicant,
  contacts,
}: {
  documentId: string
  sourceName: string
  title: string | null
  kaavaTunnus: string | null
  phase: string | null
  planType: string | null
  description: string | null
  area: string | null
  changeApplicant: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title) ?? `Kaava ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "espooKaavaParser",

    decision_index: kaavaTunnus ?? title ?? "espoo-kaava",

    description: clean(description),
    area: clean(area),
    plan_type: clean(planType),
    change_applicant: clean(changeApplicant),
    contacts,
  }

  if (kaavaTunnus) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "project_number",
      fact_value: kaavaTunnus,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (operation) {
    facts.push({
      fact_type: "operation",
      fact_key: "project_title",
      fact_value: operation,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (phase) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "project_phase",
      fact_value: phase,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  return facts
}
