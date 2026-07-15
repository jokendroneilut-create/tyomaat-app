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

export function extractTurkuKaavaFacts({
  documentId,
  sourceName,
  feature,
  center,
  kaavaTunnus,
  kaavanNimi,
  kaavalaji,
  kaavatilanne,
  documentsUrl,
  description,
  identifyingInfo,
}: {
  documentId: string
  sourceName: string
  feature: any
  center: { x: number; y: number } | null
  kaavaTunnus: string | null
  kaavanNimi: string | null
  kaavalaji: string | null
  kaavatilanne: string | null
  documentsUrl: string | null
  description?: string | null
  identifyingInfo?: Record<string, string> | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(kaavanNimi) ?? `Asemakaava ${kaavaTunnus ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "turkuKaavaParser",

    decision_index: kaavaTunnus ?? "turku-kaava",

    coordinates: center,
    kaavalaji: clean(kaavalaji),
    documents_url: clean(documentsUrl),
    identifying_info: identifyingInfo ?? {},
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
      fact_key: "kaavan_nimi",
      fact_value: operation,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (kaavatilanne) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "kaavatilanne",
      fact_value: kaavatilanne,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  return facts
}
