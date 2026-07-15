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

export function extractVaylaFacts({
  documentId,
  sourceName,
  item,
  title,
  description,
  hankeType,
  region,
  phase,
  contact,
  progress,
}: {
  documentId: string
  sourceName: string
  item: any
  title: string | null
  description: string | null
  hankeType: string | null
  region: string | null
  phase: string | null
  contact?: { organization: string | null; title: string | null; name: string | null; phone: string | null; email: string | null } | null
  progress?: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "vaylaParser",

    decision_index: String(item?.link ?? "vayla"),

    hanke_type: clean(hankeType),
    region: clean(region),
    description: clean(description),
    contact: contact ?? null,
    progress: clean(progress ?? null),
  }

  if (title) {
    facts.push({
      fact_type: "operation",
      fact_key: "title",
      fact_value: title,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (phase) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "hankkeen_vaihe",
      fact_value: phase,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  return facts
}
