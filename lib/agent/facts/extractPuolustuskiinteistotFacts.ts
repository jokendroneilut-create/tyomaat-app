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

export function extractPuolustuskiinteistotFacts({
  documentId,
  sourceName,
  title,
  description,
  publishedAt,
  completed,
}: {
  documentId: string
  sourceName: string
  title: string | null
  description: string | null
  publishedAt: string | null
  completed: boolean
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(title)

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "puolustuskiinteistotParser",

    decision_index: title ?? "puolustuskiinteistot-artikkeli",

    description: clean(description),
    published_at: publishedAt,
  }

  if (operation) {
    facts.push({
      fact_type: "operation",
      fact_key: "article_title",
      fact_value: operation,
      confidence: 0.7,
      metadata: commonMetadata,
    })
  }

  facts.push({
    fact_type: "decision_status",
    fact_key: "completion_status",
    fact_value: completed ? "Valmistunut" : "Rakenteilla",
    confidence: 0.6,
    metadata: commonMetadata,
  })

  return facts
}
