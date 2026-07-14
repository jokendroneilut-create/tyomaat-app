import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(
  facts: any[],
  type: string
) {
  return facts.find(
    (fact) => fact.fact_type === type
  )
}

function splitOrganisations(
  value: string | null
) {
  if (!value) return []

  return value
    .split("//")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

/*
 * Hankintayksikön osoite on Suomessa aina muotoa "<katu> <postinumero>
 * <kaupunki> FIN" — kaupunki on nimessä perusmuodossa, joten se on
 * poimittavissa luotettavasti toisin kuin vapaan tekstin taivutusmuodot.
 */
function extractCityFromBuyerAddress(
  buyerAddress: string | null
): string | null {
  if (!buyerAddress) return null

  const match = buyerAddress.match(
    /\d{5}\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*(?:\s[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*)*)\s+FIN\s*$/
  )

  return match?.[1]?.trim() ?? null
}

/*
 * Hankintayksikön osoite ei aina ole sama kuin työmaan sijainti — esim.
 * valtakunnalliset virastot voivat kilpailuttaa hankkeita missä päin
 * Suomea tahansa. Käytetään hankintayksikön kaupunkia vain kun
 * ilmoituksen oma teksti (kuvaus tai organisaation nimi) tukee samaa
 * kaupunkia, mikä pätee luotettavasti paikallisiin toimijoihin (kunnat,
 * seurakunnat, kuntayhtymät). Taivutusmuotojen takia (esim. "Orivesi" ->
 * "Oriveden") verrataan vain nimen alkuosaa, ei koko sanaa.
 */
function isCityCorroboratedByText(
  city: string,
  ...texts: (string | null)[]
): boolean {
  const stem = city.toLowerCase().slice(0, Math.min(5, city.length))

  return texts.some((text) => text && text.toLowerCase().includes(stem))
}

export async function resolveHilmaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation =
    findFact(facts, "operation")?.fact_value ??
    document.title

  const description =
    findFact(facts, "description")?.fact_value ??
    null

  const developer =
    findFact(facts, "developer")?.fact_value ??
    null

  /*
   * Hankintayksikön osoite säilytetään erikseen.
   * Sitä ei käytetä potentiaalisen hankkeen address-kenttänä.
   */
  const buyerAddress =
    findFact(facts, "buyer_address")?.fact_value ??
    null

  const buyerCity = extractCityFromBuyerAddress(buyerAddress)
  const buyerMunicipality = getMunicipalityByName(buyerCity)

  /*
   * Mahdollinen oikea rakennuskohteen osoite voidaan
   * myöhemmin poimia omaksi project_address-faktaksi.
   */
  const projectAddress =
    findFact(facts, "project_address")?.fact_value ??
    null

  const deadline =
    findFact(facts, "deadline")?.fact_date ??
    null

  const expirationDate =
    findFact(facts, "expiration_date")?.fact_date ??
    null

  const cpvCode =
    findFact(facts, "cpv_code")?.fact_value ??
    null

  const documentsUrl =
    findFact(facts, "documents_url")?.fact_value ??
    null

  const noticeNumber =
    findFact(facts, "permit_number")?.fact_value ??
    null

  const mainType =
    findFact(facts, "notice_main_type")?.fact_value ??
    facts[0]?.metadata?.main_type ??
    null

  const noticeType =
    findFact(facts, "notice_type")?.fact_value ??
    facts[0]?.metadata?.notice_type ??
    null

  const linkedNotices =
    findFact(facts, "linked_notice")?.fact_value ??
    facts[0]?.metadata?.linked_notices ??
    null

  const parentNoticeId =
    findFact(facts, "parent_notice_id")?.fact_value ??
    facts[0]?.metadata?.parent_notice_id ??
    null

  const winnerOrganisations =
    findFact(
      facts,
      "winner_organisations"
    )?.fact_value ??
    facts[0]?.metadata?.winner_organisations ??
    null

  const winners = splitOrganisations(
    winnerOrganisations
  )

  const receivedTenderCount =
    findFact(
      facts,
      "received_tender_count"
    )?.fact_number ??
    facts[0]?.metadata?.received_tender_count ??
    null

  const contractValue =
    findFact(
      facts,
      "contract_value"
    )?.fact_number ??
    facts[0]?.metadata?.contract_value ??
    null

  const contractCurrency =
    findFact(
      facts,
      "contract_currency"
    )?.fact_value ??
    facts[0]?.metadata?.contract_currency ??
    null

  const metadata =
    facts[0]?.metadata ?? {}

  const isContractAward =
    normalize(mainType) ===
      "contractawardnotices" ||
    winners.length > 0 ||
    metadata.is_contract_award === true

  const phaseHint = isContractAward
    ? PHASE_LABELS.contract_awarded
    : PHASE_LABELS.tender

  const classification = classifyProject({
    operation,
    address: projectAddress,
    title: operation,
  })

  /*
   * Hankintayksikön osoitetta ei tallenneta työmaan osoitteeksi (voi
   * poiketa työmaasta esim. valtakunnallisilla toimijoilla), mutta sen
   * kaupunkia voidaan käyttää hankkeen sijaintikuntana kun ilmoituksen
   * oma teksti tukee samaa kaupunkia (ks. isCityCorroboratedByText).
   */
  const municipality =
    buyerMunicipality &&
    isCityCorroboratedByText(buyerMunicipality.name, description, developer)
      ? buyerMunicipality.name
      : null

  const result = await resolvePotentialProject({
    title: operation,
    municipality,
    address: projectAddress,
    propertyId: null,

    permitNumber: noticeNumber,
    sourceName: document.source_name,

    identifiers: [
      { type: "hilma_notice_number", value: noticeNumber },
      { type: "hilma_notice_number", value: parentNoticeId },
      { type: "hilma_notice_number", value: linkedNotices },
    ],

    metadata: {
      source: "Hilma",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "hilmaResolver",

      operation,
      description,
      developer,

      region: municipality ? buyerMunicipality?.region ?? null : null,

      buyer_address: buyerAddress,
      project_address: projectAddress,

      deadline,
      expiration_date: expirationDate,

      cpv_code: cpvCode,
      documents_url: documentsUrl,

      notice_number: noticeNumber,
      notice_id: metadata.notice_id ?? null,
      notice_type: noticeType,
      main_type: mainType,

      linked_notices: linkedNotices,
      parent_notice_id: parentNoticeId,

      date_published:
        metadata.date_published ?? null,

      date_modified:
        metadata.date_modified ?? null,

      procurement_type_code:
        metadata.procurement_type_code ?? null,

      procedure_type:
        metadata.procedure_type ?? null,

      contract_folder_id:
        metadata.contract_folder_id ?? null,

      full_eforms_id:
        metadata.full_eforms_id ?? null,

      eforms_id:
        metadata.eforms_id ?? null,

      is_cancelled:
        metadata.is_cancelled ?? false,

      is_contract_award: isContractAward,
      phase_hint: phaseHint,

      winner_organisations:
        winnerOrganisations,

      winners,

      received_tender_count:
        receivedTenderCount,

      contract_value:
        contractValue,

      contract_currency:
        contractCurrency,

      construction_type:
        classification.construction_type,

      building_type:
        classification.building_type,

      size_class:
        classification.size_class,

      business_value:
        classification.business_value,

      recommended_action:
        classification.recommended_action,

      classification_confidence:
        classification.confidence,

      classification_reasons:
        classification.reasons,
    },
  })

  return {
    action: result.action,
    potentialProjectId:
      result.potentialProject.id,

    title:
      result.potentialProject.title,

    address:
      result.potentialProject.address,

    permitNumber:
      result.potentialProject.permit_number,

    operation,
    mainType,
    noticeType,
    isContractAward,
    phaseHint,
    winners,
    receivedTenderCount,
    contractValue,
    contractCurrency,
    classification,
  }
}