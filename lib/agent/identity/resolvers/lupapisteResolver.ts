import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipality } from "@/lib/geo/municipalities"
import { tm35finToWgs84 } from "@/lib/geo/tm35fin"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveLupapisteProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const permitNumber = findFact(facts, "permit_number")?.fact_value ?? null
  const propertyId = findFact(facts, "property_id")?.fact_value ?? null
  const address = findFact(facts, "address")?.fact_value ?? null
  const municipalityCode = findFact(facts, "municipality_code")?.fact_value ?? null
  const rawOperation = findFact(facts, "operation")?.fact_value ?? document.title
  const operation = rawOperation ? rawOperation.replace(/\s*\n+\s*/g, " ").trim() : rawOperation
  const decisionStatus = findFact(facts, "decision_status")?.fact_value ?? null
  const decisionText = findFact(facts, "decision_text")?.fact_value ?? null
  const deadline = findFact(facts, "deadline")?.fact_date ?? null

  const metadata = facts[0]?.metadata ?? {}
  const municipality = getMunicipality(municipalityCode)

  const title = [operation, address].filter(Boolean).join(": ") || operation

  /*
   * Lupapisten oma operaatiokuvaus (bulletinOpDescription) on usein vain
   * prosessin yleinen nimike (esim. "Poikkeamispäätös: Poikkeaminen") eikä
   * kerro mitä hankkeessa oikeasti tehdään — varsinainen sisältö on vain
   * päätöstekstissä. Näytetään koko päätösteksti Lisätietoja-kentässä.
   */
  const description = [
    propertyId ? `Kiinteistötunnus: ${propertyId}` : null,
    address ? `Osoite: ${address}` : null,
    operation ? `Toimenpide: ${operation}` : null,
    decisionText ? `Päätös:\n${decisionText}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? tm35finToWgs84(coordinates.x, coordinates.y)
      : null

  const isFinal = decisionStatus === "final" || decisionStatus === "myonnetty"
  const phaseHint = PHASE_LABELS.permit

  const classification = classifyProject({
    operation,
    address,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title,
    municipality: municipality?.name ?? municipalityCode,
    address,
    propertyId,
    permitNumber,
    sourceName: document.source_name,

    identifiers: [
      { type: "lupapiste_permit_number", value: permitNumber },
      { type: "property_id", value: propertyId },
    ],

    metadata: {
      source: "Lupapiste",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "lupapisteResolver",

      operation,
      description,
      municipality_code: municipalityCode,
      region: municipality?.region ?? null,

      decision_status: decisionStatus,
      decision_text: decisionText,
      is_final: isFinal,
      deadline,

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
    address: result.potentialProject.address,
    permitNumber: result.potentialProject.permit_number,
    operation,
    municipality: municipality?.name ?? municipalityCode,
    decisionStatus,
    phaseHint,
    classification,
  }
}
