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

export function extractSenaattiFacts({
  documentId,
  sourceName,
  post,
  title,
  description,
  phase,
  location,
  buildingType,
  contact,
}: {
  documentId: string
  sourceName: string
  post: any
  title: string | null
  description: string | null
  phase: string | null
  location: string | null
  buildingType: string | null
  contact: { name: string | null; title: string | null; email: string | null } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "senaattiParser",

    decision_index: String(post?.id ?? "senaatti"),

    location: clean(location),
    building_type: clean(buildingType),
    description: clean(description),
    contact,
  }

  if (title) {
    facts.push({
      fact_type: "operation",
      fact_key: "title",
      fact_value: title,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  if (phase) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "senaatti_phase",
      fact_value: phase,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  return facts
}
