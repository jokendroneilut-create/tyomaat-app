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

function toNullableNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toNullableString(value: unknown) {
  if (value == null) return null
  return clean(String(value))
}

function splitOrganisations(value: string | null) {
  if (!value) return []

  return value
    .split("//")
    .map((item) => item.trim())
    .filter(Boolean)
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

  const title = clean(
    notice.titleFi ||
      notice.titleSv ||
      notice.titleEn
  )

  const description = clean(
    notice.descriptionFi ||
      notice.descriptionSv ||
      notice.descriptionEn
  )

  const organisationName = clean(
    notice.organisationNameFi ||
      notice.organisationNameSv ||
      notice.organisationNameEn
  )

  /*
   * Tämä on hankintayksikön osoite, ei työmaan osoite.
   * Sitä ei tallenneta fact_type="address"-kenttään.
   */
  const organisationAddress = clean(
    notice.organisationAddress
  )

  const cpvCodes = clean(notice.cpvCodes)

  /*
   * Vain oikea deadline kelpaa tarjousten määräajaksi.
   * expirationDate ei ole sama asia.
   */
  const deadline = clean(notice.deadline)

  const expirationDate = clean(
    notice.expirationDate
  )

  const documentsUrl = clean(
    notice.procurementDocumentsUrl
  )

  const noticeNumber = clean(
    notice.noticeNumber
  )

  const noticeId = notice.noticeId
    ? String(notice.noticeId)
    : null

  const mainType = clean(notice.mainType)
  const noticeType = clean(notice.type)

  const linkedNotices = toNullableString(
    notice.linkedNotices
  )

  const parentNoticeId = notice.parentNoticeId
    ? String(notice.parentNoticeId)
    : null

  const winnerOrganisations = clean(
    notice.winnerOrganisations
  )

  const winners = splitOrganisations(
    winnerOrganisations
  )

  const receivedTenderCount = toNullableNumber(
    notice.receivedTenderCount
  )

  const contractValue =
    toNullableNumber(
      notice.noticeResultTotalAmount
    ) ??
    toNullableNumber(
      notice.lotResultTotalAmount
    ) ??
    toNullableNumber(
      notice.overallMaximumFrameworkContractsAmount
    ) ??
    toNullableNumber(
      notice.overallApproximateFrameworkContractsAmount
    )

  const contractCurrency =
    clean(notice.noticeResultTotalAmountCurrency) ??
    clean(notice.lotResultTotalAmountCurrency) ??
    clean(notice.overallMaximumFrameworkContractsCurrency) ??
    clean(notice.overallApproximateFrameworkContractsCurrency)

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "hilmaParser",

    decision_index:
      noticeId ??
      noticeNumber ??
      "hilma",

    notice_id: noticeId,
    notice_number: noticeNumber,
    notice_type: noticeType,
    main_type: mainType,

    date_published:
      notice.datePublished ?? null,

    date_modified:
      notice.dateModified ?? null,

    procurement_type_code:
      notice.procurementTypeCode ?? null,

    procedure_type:
      notice.procedureType ?? null,

    cpv_codes: cpvCodes,
    nuts_codes: notice.nutsCodes ?? null,

    linked_notices: linkedNotices,
    parent_notice_id: parentNoticeId,

    contract_folder_id:
      notice.contractFolderId ?? null,

    full_eforms_id:
      notice.fullEFormsId ?? null,

    eforms_id:
      notice.eFormsId ?? null,

    is_cancelled:
      notice.isCancelled ?? false,

    is_contract_award:
      mainType === "ContractAwardNotices" ||
      winners.length > 0,

    winner_organisations:
      winnerOrganisations,

    winners,

    received_tender_count:
      receivedTenderCount,

    contract_value:
      contractValue,

    contract_currency:
      contractCurrency,

    expiration_date:
      expirationDate,
  }

  if (title) {
    facts.push({
      fact_type: "operation",
      fact_key: "title",
      fact_value: title,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (description) {
    facts.push({
      fact_type: "description",
      fact_key: "description",
      fact_value: truncate(description),
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (organisationName) {
    facts.push({
      fact_type: "developer",
      fact_key: "organisation_name",
      fact_value: organisationName,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (organisationAddress) {
    facts.push({
      fact_type: "buyer_address",
      fact_key: "organisation_address",
      fact_value: organisationAddress,
      confidence: 0.98,
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
      fact_key: "tender_deadline",
      fact_date: deadline,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (expirationDate) {
    facts.push({
      fact_type: "expiration_date",
      fact_key: "expiration_date",
      fact_date: expirationDate,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (documentsUrl) {
    facts.push({
      fact_type: "documents_url",
      fact_key: "procurement_documents_url",
      fact_value: documentsUrl,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (noticeNumber) {
    facts.push({
      fact_type: "permit_number",
      fact_key: "notice_number",
      fact_value: noticeNumber,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (mainType) {
    facts.push({
      fact_type: "notice_main_type",
      fact_key: "main_type",
      fact_value: mainType,
      confidence: 0.99,
      metadata: commonMetadata,
    })
  }

  if (noticeType) {
    facts.push({
      fact_type: "notice_type",
      fact_key: "notice_type",
      fact_value: noticeType,
      confidence: 0.99,
      metadata: commonMetadata,
    })
  }

  if (linkedNotices) {
    facts.push({
      fact_type: "linked_notice",
      fact_key: "linked_notices",
      fact_value: linkedNotices,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  if (parentNoticeId) {
    facts.push({
      fact_type: "parent_notice_id",
      fact_key: "parent_notice_id",
      fact_value: parentNoticeId,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (winnerOrganisations) {
    facts.push({
      fact_type: "winner_organisations",
      fact_key: "winner_organisations",
      fact_value: winnerOrganisations,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (receivedTenderCount != null) {
    facts.push({
      fact_type: "received_tender_count",
      fact_key: "received_tender_count",
      fact_number: receivedTenderCount,
      confidence: 0.98,
      metadata: commonMetadata,
    })
  }

  if (contractValue != null) {
    facts.push({
      fact_type: "contract_value",
      fact_key: "contract_value",
      fact_number: contractValue,
      confidence: 0.9,
      metadata: {
        ...commonMetadata,
        currency: contractCurrency,
      },
    })
  }

  if (contractCurrency) {
    facts.push({
      fact_type: "contract_currency",
      fact_key: "contract_currency",
      fact_value: contractCurrency,
      confidence: 0.95,
      metadata: commonMetadata,
    })
  }

  return facts
}