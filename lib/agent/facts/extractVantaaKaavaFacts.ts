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

function toIsoDate(value: unknown): string | null {
  const str = clean(value)
  if (!str || str.length !== 8) return null

  const iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`
  const parsed = new Date(iso)
  return isNaN(parsed.getTime()) ? null : iso
}

export type VantaaContact = {
  name: string
  title: string | null
  phone: string | null
  email: string | null
}

export function extractVantaaKaavaFacts({
  documentId,
  sourceName,
  feature,
  center,
  hakija,
  contacts,
  description,
}: {
  documentId: string
  sourceName: string
  feature: any
  center: { x: number; y: number } | null
  hakija?: string | null
  contacts?: VantaaContact[] | null
  description?: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []
  const properties = feature.properties ?? {}

  const kaavaTunnus = clean(properties.kaavatunnus)
  const kaavaNimi = clean(properties.kaavanimi1)
  const vaihe = clean(properties.vaihe)
  const kaavalinkki = clean(properties.kaavalinkki)
  const kasitPvm = toIsoDate(properties.kasit_pvm)
  const oasPvm = toIsoDate(properties.oas_pvm)
  const hakijaClean = clean(hakija)

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "vantaaKaavaParser",

    decision_index: kaavaTunnus ?? "vantaa-kaava",

    kaavalinkki,
    kasit_pvm: kasitPvm,
    oas_pvm: oasPvm,
    coordinates: center,
    contacts: contacts ?? [],
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

  if (kaavaNimi) {
    facts.push({
      fact_type: "operation",
      fact_key: "kaavanimi1",
      fact_value: kaavaNimi,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (vaihe) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "vaihe",
      fact_value: vaihe,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (kaavalinkki) {
    facts.push({
      fact_type: "documents_url",
      fact_key: "kaavalinkki",
      fact_value: kaavalinkki,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (kasitPvm) {
    facts.push({
      fact_type: "decision_date",
      fact_key: "kasit_pvm",
      fact_date: kasitPvm,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  if (hakijaClean) {
    facts.push({
      fact_type: "developer",
      fact_key: "hakija",
      fact_value: hakijaClean,
      confidence: 0.8,
      metadata: commonMetadata,
    })
  }

  return facts
}
