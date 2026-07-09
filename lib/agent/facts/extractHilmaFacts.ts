export type ExtractedFact = {
  fact_type: string
  fact_key?: string | null
  fact_value?: string | null
  fact_number?: number | null
  fact_date?: string | null
  confidence: number
  metadata?: Record<string, any>
}

function clean(value: any) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function truncate(value: string | null, maxLength = 1200) {
  if (!value) return null
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export function extractHilmaFacts({
  documentId,
  sourceName,
  notice,
}: {
  documentId: string
  sourceName: string
  notice: any
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const title = clean(notice.titleFi || notice.titleSv || notice.titleEn)
  const description = clean(
    notice.descriptionFi || notice.descriptionSv || notice.descriptionEn
  )
  const organisationName = clean(
    notice.organisationNameFi ||
      notice.organisationNameSv ||
      notice.organisationNameEn
  )

  const organisationAddress = clean(notice.organisationAddress)
  const cpvCodes = clean(notice.cpvCodes)
  const deadline = clean(notice.deadline || notice.expirationDate)
  const documentsUrl = clean(notice.procurementDocumentsUrl)
  const noticeNumber = clean(notice.noticeNumber)
  const noticeId = notice.noticeId ? String(notice.noticeId) : null

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "hilmaParser",
    decision_index: noticeId ?? noticeNumber ?? "hilma",
    notice_id: noticeId,
    notice_number: noticeNumber,
    date_published: notice.datePublished ?? null,
    procurement_type_code: notice.procurementTypeCode ?? null,
    main_type: notice.mainType ?? null,
    cpv_codes: cpvCodes,
  }

  if (title) {
    facts.push({
      fact_type: "description",
      fact_key: "description",
      fact_value: truncate(description),
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (description) {
    facts.push({
      fact_type: "description",
      fact_key: "description",
      fact_value: description,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  if (organisationName) {
    facts.push({
      fact_type: "developer",
      fact_key: "organisation_name",
      fact_value: organisationName,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  if (organisationAddress) {
    facts.push({
      fact_type: "address",
      fact_key: "organisation_address",
      fact_value: organisationAddress,
      confidence: 0.7,
      metadata: commonMetadata,
    })
  }

  if (cpvCodes) {
    facts.push({
      fact_type: "cpv_code",
      fact_key: "cpv_codes",
      fact_value: cpvCodes,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (deadline) {
    facts.push({
      fact_type: "deadline",
      fact_key: "deadline",
      fact_date: deadline,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (documentsUrl) {
    facts.push({
      fact_type: "documents_url",
      fact_key: "procurement_documents_url",
      fact_value: documentsUrl,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (noticeNumber) {
    facts.push({
      fact_type: "permit_number",
      fact_key: "notice_number",
      fact_value: noticeNumber,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  return facts
}