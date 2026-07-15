import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk24ToWgs84 } from "@/lib/geo/gk24"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveTampereKaavaProject({
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
  const diaarinumero = metadata.diaarinumero ?? null
  const decisionMaker = metadata.decision_maker ?? null
  const municipality = getMunicipalityByName("Tampere")

  /*
   * Otsikon ensimmäinen pilkulla erotettu osa on kaupunginosa, esim.
   * "ATALA, Pulkkakatu 2, 6, 8, ja 14, asemakaava nro 9015" — Atala.
   */
  const district = operation?.includes(",") ? operation.split(",")[0].trim() : null

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? gk24ToWgs84(coordinates.x, coordinates.y)
      : null

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Tampere",
    // Kaavan nimi on usein katuosoite/paikannimi eikä lähde tarjoa muuta osoitetta.
    address: operation,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "tampere_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Tampereen kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "tampereKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      municipality_code: null,
      region: municipality?.region ?? null,
      district_name: district,

      decision_status: fieldPhase,
      diaarinumero,
      decision_maker: decisionMaker,
      documents_url: document.document_url,

      description,

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
    municipality: municipality?.name ?? "Tampere",
    fieldPhase,
    phaseHint,
    classification,
  }
}
