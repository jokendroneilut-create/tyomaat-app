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

/*
 * GRANLUNDIN HANKEFAKTAT.
 *
 * Granlund on suunnittelija, joten sen tiedot ovat hankkeesta
 * AIKAISEMMIN kuin urakoitsijan. Mitattu 26.8.2026, 211 hanketta:
 * Tilaaja 99 %, Paikkakunta 100 %, kuvaus 100 % (mediaani 651 merkkiä).
 *
 * Tilaaja on tässä arvokkain kenttä: se on juuri se jota useimmista
 * lähteistä ei saa, ja se on hankkeen maksaja.
 */
export function extractGranlundFacts({
  documentId,
  sourceName,
  post,
  title,
  description,
  fields,
}: {
  documentId: string
  sourceName: string
  post: any
  title: string | null
  description: string | null
  fields: any
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "granlundParser",

    granlund_post_id: String(post?.id ?? "granlund"),

    description: clean(description),
    city: clean(fields?.city),
    developer: clean(fields?.developer),
    project_type: clean(fields?.projectType),
    area_text: clean(fields?.area),
    start_year: fields?.startYear ?? null,
    completion_year: fields?.completionYear ?? null,
    estimated_completion: clean(fields?.estimatedCompletion),
    other_companies: Array.isArray(fields?.otherCompanies) ? fields.otherCompanies : [],
    granlund_services: Array.isArray(fields?.granlundServices) ? fields.granlundServices : [],
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

  /*
   * Tilaaja omana faktanaan, koska se on lahteen vahvin anti (99 %) ja
   * hyvaksynta lukee sen metadata.developer-kentasta.
   */
  const developer = clean(fields?.developer)
  if (developer) {
    facts.push({
      fact_type: "developer",
      fact_key: "tilaaja",
      fact_value: developer,
      confidence: 0.85,
      metadata: commonMetadata,
    })
  }

  return facts
}
