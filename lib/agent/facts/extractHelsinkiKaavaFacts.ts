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

export function extractHelsinkiKaavaFacts({
  documentId,
  sourceName,
  feature,
  center,
  districtName,
  description,
  planName,
  address,
  selostusUrl,
}: {
  documentId: string
  sourceName: string
  feature: any
  center: { x: number; y: number } | null
  districtName?: string | null
  description?: string | null
  planName?: string | null
  address?: string | null
  selostusUrl?: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []
  const properties = feature.properties ?? {}

  const kaavaTunnus = clean(properties.kaavatunnus)
  const luokka = clean(properties.luokka)
  const hyvaksymispvm = clean(properties.hyvaksymispvm)
  const pintaala = typeof properties.pintaala === "number" ? properties.pintaala : null

  const operation =
    clean(planName ?? null) ??
    (kaavaTunnus ? `Kaava ${kaavaTunnus}${districtName ? ` – ${districtName}` : ""}` : districtName)

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "helsinkiKaavaParser",

    decision_index: kaavaTunnus ?? "helsinki-kaava",

    district_name: districtName ?? null,
    district_code: clean(properties.sijaintialue),
    hyvaksymispvm,
    site_area_m2: pintaala,
    coordinates: center,
    description: clean(description ?? null),
    address: clean(address ?? null),
  }

  if (selostusUrl) {
    facts.push({
      fact_type: "documents_url",
      fact_key: "selostus_url",
      fact_value: selostusUrl,
      confidence: 0.9,
      metadata: commonMetadata,
    })
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
      fact_key: "operation",
      fact_value: operation,
      confidence: 0.7,
      metadata: commonMetadata,
    })
  }

  if (luokka) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "luokka",
      fact_value: luokka,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (pintaala !== null) {
    facts.push({
      fact_type: "site_area_m2",
      fact_key: "pintaala",
      fact_number: pintaala,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  return facts
}
