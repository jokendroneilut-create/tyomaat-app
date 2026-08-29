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
 * OPISKELIJA-ASUNTOSÄÄTIÖN HANKEFAKTAT.
 *
 * Rakennuttaja on lähde itse, joten sitä ei tarvitse päätellä — se on
 * juuri se kenttä joka useimmista lähteistä puuttuu.
 *
 * Urakoitsija on tämän lähteen toinen vahvuus: tiedotteissa lukee
 * suoraan "Varte Oy toteuttaa hankkeen AYY:lle". Se ei kuitenkaan ole
 * joka tiedotteessa, ja puuttuvaa ei keksitä.
 */
export function extractFoundationFacts({
  documentId,
  sourceName,
  post,
  title,
  fields,
  developer,
}: {
  documentId: string
  sourceName: string
  post: any
  title: string | null
  fields: any
  /* Säätiön nimi, eli hankkeen rakennuttaja. Tulee lähdekonfiguraatiosta. */
  developer: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "foundationReleaseParser",

    foundation_post_id: String(post?.id ?? "foundation"),

    project_name: clean(fields?.projectName),
    developer: clean(developer),
    builder: clean(fields?.builder),
    apartments: fields?.apartments ?? null,
    floor_area: fields?.floorArea ?? null,
    estimated_completion: clean(fields?.estimatedCompletion),
    phase_hint: clean(fields?.phaseHint),
    published_at: clean(post?.date),
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

  /* Rakennuttaja tiedetään lähteestä, joten luottamus on korkea. */
  if (clean(developer)) {
    facts.push({
      fact_type: "developer",
      fact_key: "rakennuttaja",
      fact_value: clean(developer),
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  /*
   * Urakoitsija omana faktanaan. Luottamus on matalampi kuin
   * rakennuttajalla, koska se on luettu proosasta eikä kentästä.
   */
  const builder = clean(fields?.builder)
  if (builder) {
    facts.push({
      fact_type: "builder",
      fact_key: "urakoitsija",
      fact_value: builder,
      confidence: 0.8,
      metadata: commonMetadata,
    })
  }

  return facts
}
