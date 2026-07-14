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

export function extractTampereKaavaFacts({
  documentId,
  sourceName,
  feature,
  center,
  kaavaTunnus,
  diaarinumero,
  phase,
  description,
  decisionMaker,
  planTitle,
}: {
  documentId: string
  sourceName: string
  feature: any
  center: { x: number; y: number } | null
  kaavaTunnus: string | null
  diaarinumero: string | null
  phase?: string | null
  description?: string | null
  decisionMaker?: string | null
  planTitle?: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(planTitle) ?? clean(diaarinumero) ?? `Asemakaava nro ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "tampereKaavaParser",

    decision_index: kaavaTunnus ?? "tampere-kaava",

    coordinates: center,
    diaarinumero: clean(diaarinumero),
    decision_maker: clean(decisionMaker),
    description: clean(description),
  }

  if (kaavaTunnus) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "kaavatunnus",
      fact_value: kaavaTunnus,
      confidence: 0.98,
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
