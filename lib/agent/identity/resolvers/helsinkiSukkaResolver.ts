import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk25ToWgs84 } from "@/lib/geo/gk25"
import { extractConsultantsFromAttachments } from "@/lib/agent/identity/extractConsultantsFromAttachments"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

/*
 * Helsingin kartta.hel.fi:n "sukka"-rajapinnan resolveri. Sama rakenne kuin
 * Kuopion vastaavalla, mutta Helsingin data on rikkaampi (diaarinumero,
 * hankenumero, rakentamispäivät) ja koordinaatit ovat EPSG:3879 (GK25FIN).
 * Tunnisteena diaarinumero (helsinki_diaarinumero), koska kaavanumero on
 * lähes aina tyhjä. Tämä lähde korvaa Helsingin vanhan WFS-lähteen, joten
 * eri tunnistetyyppi ei aiheuta duplikaatteja.
 */
export async function resolveHelsinkiSukkaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? null
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const fieldPhase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const recordNumber = metadata.record_number ?? null
  const hankeNumber = metadata.hanke_number ?? null
  const planType = metadata.plan_type ?? null
  const buildingStartDate = metadata.building_start_date ?? null
  const buildingEndDate = metadata.building_end_date ?? null
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
    metadata.contacts ?? []

  const municipality = getMunicipalityByName("Helsinki")

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? gk25ToWgs84(coordinates.x, coordinates.y)
      : null

  const phaseHint = PHASE_LABELS.zoning

  /*
   * Kaavan liiteasiakirjojen otsikoista poimitaan mukana olevat konsultti-/
   * arkkitehtitoimistot (esim. Ramboll, Saatsi Arkkitehdit). Nämä ovat
   * kaavavaiheen selvitysten tekijöitä — näytetään kortilla erillisenä
   * "Selvitykset/konsultit" -osiona, ei sekoitettuna urakoitsijoihin.
   */
  const attachmentTitles: string[] = Array.isArray(metadata.attachment_titles)
    ? metadata.attachment_titles
    : []
  const consultants = await extractConsultantsFromAttachments(attachmentTitles)

  const classification = classifyProject({
    operation,
    title: operation,
    description,
  })

  const contactPersons = contacts
    .filter((c) => c.name)
    .map((c) => ({
      name: c.name,
      title: c.title ?? planType ?? "Kaavoitus",
      phone: c.phone ?? null,
      email: c.email ?? null,
    }))

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Helsinki",
    // Kaavan nimi on usein paikannimi/katuosoite eikä lähde tarjoa muuta osoitetta.
    address: operation,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [
      { type: "helsinki_diaarinumero", value: recordNumber ?? hankeNumber },
    ],

    metadata: {
      source: "Helsingin kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "helsinkiSukkaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      record_number: recordNumber,
      hanke_number: hankeNumber,
      plan_type: planType,
      region: municipality?.region ?? null,

      decision_status: fieldPhase,
      documents_url: document.document_url,

      description,
      contact_persons: contactPersons,
      consultants,

      construction_start: buildingStartDate,
      construction_end: buildingEndDate,

      lupapiste_coordinates: coordinates,
      lupapiste_coordinates_wgs84: wgs84,

      phase_hint: phaseHint,

      construction_type: classification.construction_type,
      building_type: classification.building_type,
      size_class: classification.size_class,
      business_value: classification.business_value,
      recommended_action: classification.recommended_action,
      classification_confidence: classification.confidence,
      classification_reasons: classification.reasons,
    },
  })

  return {
    action: result.action,
    potentialProjectId: result.potentialProject.id,
    title: result.potentialProject.title,
    kaavaTunnus,
    recordNumber,
    municipality: municipality?.name ?? "Helsinki",
    fieldPhase,
    phaseHint,
    classification,
  }
}
