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
 * Helsingin kartta.hel.fi:n "sukka"-rajapinnasta poimitut faktat. Rakenteel-
 * taan sama kuin Kuopion vastaava (extractKuopioKaavaFacts), mutta Helsingin
 * datassa on lisäksi diaarinumero (record_number), hankenumero ja
 * rakentamisen alku/loppu-päivät. Kaavanumero (plan_number) on Helsingissä
 * lähes aina tyhjä, joten tunnisteena käytetään diaarinumeroa.
 */
export function extractHelsinkiSukkaFacts({
  documentId,
  sourceName,
  planName,
  planNumber,
  recordNumber,
  hankeNumber,
  phase,
  planType,
  description,
  contacts,
  buildingStartDate,
  buildingEndDate,
  attachmentTitles,
  center,
}: {
  documentId: string
  sourceName: string
  planName: string | null
  planNumber: string | null
  recordNumber: string | null
  hankeNumber: string | null
  phase: string | null
  planType: string | null
  description: string | null
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
  buildingStartDate: string | null
  buildingEndDate: string | null
  attachmentTitles: string[]
  center: { x: number; y: number } | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const operation = clean(planName) ?? `Kaava ${planNumber ?? recordNumber ?? "?"}`

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "helsinkiSukkaParser",

    decision_index: recordNumber ?? planNumber ?? "helsinki-sukka",

    plan_type: planType,
    plan_number: clean(planNumber),
    record_number: clean(recordNumber),
    hanke_number: clean(hankeNumber),
    building_start_date: clean(buildingStartDate),
    building_end_date: clean(buildingEndDate),
    description: clean(description),
    contacts,
    attachment_titles: Array.isArray(attachmentTitles) ? attachmentTitles : [],
    coordinates: center,
  }

  if (planNumber) {
    facts.push({
      fact_type: "kaava_tunnus",
      fact_key: "kaavatunnus",
      fact_value: planNumber,
      confidence: 0.95,
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
