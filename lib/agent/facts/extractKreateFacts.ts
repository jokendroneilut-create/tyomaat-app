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

export function extractKreateFacts({
  documentId,
  sourceName,
  post,
  title,
  phase,
  category,
  contacts,
}: {
  documentId: string
  sourceName: string
  post: any
  title: string | null
  phase: string | null
  category: string | null
  contacts: { title: string | null; name: string | null; phone: string | null; email: string | null }[]
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "kreateParser",

    decision_index: String(post?.id ?? "kreate"),

    category: clean(category),
    contacts,
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
      fact_key: "kreate_status",
      fact_value: phase,
      confidence: 0.85,
      metadata: commonMetadata,
    })
  }

  return facts
}
