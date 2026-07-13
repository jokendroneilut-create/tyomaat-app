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

function truncate(value: string | null, maxLength = 5000) {
  if (!value) return null
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export function extractLupapisteFacts({
  documentId,
  sourceName,
  notice,
}: {
  documentId: string
  sourceName: string
  notice: any
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const permitNumber = clean(notice["application-id"])
  const propertyId = clean(notice.propertyId)
  const address = clean(notice.address)
  const municipalityCode = clean(notice.municipality)
  const category = clean(notice.category)

  const operation = clean(
    notice.bulletinOpDescription ??
      notice.primaryOperation?.description ??
      notice.primaryOperation?.name
  )

  const bulletinState = clean(notice.bulletinState ?? notice.state)
  const verdictCode = clean(notice.verdictData?.code)
  const verdictText = clean(notice.verdictData?.text)
  const verdictContact = clean(notice.verdictData?.contact)
  const verdictDate = notice.verdictDate ?? null
  const appealPeriodEndsAt = notice.appealPeriodEndsAt ?? null

  const coordinates =
    Array.isArray(notice.location) && notice.location.length === 2
      ? { x: notice.location[0], y: notice.location[1] }
      : null

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "lupapisteParser",

    decision_index: permitNumber ?? notice.id ?? "lupapiste",

    municipality_code: municipalityCode,
    category,
    bulletin_process: notice.bulletinProcess ?? null,
    bulletin_state: bulletinState,
    verdict_code: verdictCode,
    verdict_date: verdictDate,
    appeal_period_starts_at: notice.appealPeriodStartsAt ?? null,
    appeal_period_ends_at: appealPeriodEndsAt,
    coordinates,
  }

  if (permitNumber) {
    facts.push({
      fact_type: "permit_number",
      fact_key: "application_id",
      fact_value: permitNumber,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (propertyId) {
    facts.push({
      fact_type: "property_id",
      fact_key: "property_id",
      fact_value: propertyId,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (address) {
    facts.push({
      fact_type: "address",
      fact_key: "address",
      fact_value: address,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (municipalityCode) {
    facts.push({
      fact_type: "municipality_code",
      fact_key: "municipality_code",
      fact_value: municipalityCode,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (operation) {
    facts.push({
      fact_type: "operation",
      fact_key: "operation",
      fact_value: operation,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (bulletinState || verdictCode) {
    facts.push({
      fact_type: "decision_status",
      fact_key: "bulletin_state",
      fact_value: verdictCode ?? bulletinState,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (verdictText) {
    facts.push({
      fact_type: "decision_text",
      fact_key: "verdict_text",
      fact_value: truncate(verdictText),
      confidence: 0.9,
      metadata: {
        ...commonMetadata,
        contact: verdictContact,
      },
    })
  }

  if (appealPeriodEndsAt) {
    facts.push({
      fact_type: "deadline",
      fact_key: "appeal_period_ends_at",
      fact_date: new Date(appealPeriodEndsAt).toISOString(),
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  return facts
}
