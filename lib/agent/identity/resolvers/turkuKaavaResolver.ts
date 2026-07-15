import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk23ToWgs84 } from "@/lib/geo/gk23"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

/*
 * KaavanNimi on muotoa "{kaupunginosa} {kiinteistötunnus}, os. {osoite}"
 * (esim. "Perno 065-40-3, os. Heinikonkatu 2") — puretaan kaupunginosa
 * ja osoite parhaan kyvyn mukaan, mutta koko nimi jää joka tapauksessa
 * otsikoksi jos jäsennys ei osu kohdalleen.
 */
function parseDistrictAndAddress(kaavanNimi: string | null): {
  district: string | null
  address: string | null
} {
  if (!kaavanNimi) return { district: null, address: null }

  const [left, right] = kaavanNimi.split(",").map((part) => part.trim())
  const address = right ? right.replace(/^os\.\s*/i, "").trim() || null : null
  const district = left?.match(/^([A-ZÅÄÖa-zåäö]+(?:\s[A-ZÅÄÖa-zåäö]+)*)/)?.[1]?.trim() ?? null

  return { district, address }
}

export async function resolveTurkuKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? null
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const kaavatilanne = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const kaavalaji = metadata.kaavalaji ?? null
  const documentsUrl = metadata.documents_url ?? document.document_url
  const identifyingInfo: Record<string, string> = metadata.identifying_info ?? {}
  const municipality = getMunicipalityByName("Turku")

  const { district, address } = parseDistrictAndAddress(operation)

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? gk23ToWgs84(coordinates.x, coordinates.y)
      : null

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation: kaavalaji ?? operation,
    address,
    title: operation,
  })

  const fullDescription = [
    description,
    ...Object.entries(identifyingInfo).map(([label, value]) => `${label}: ${value}`),
  ]
    .filter(Boolean)
    .join("\n")

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Turku",
    address,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "turku_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Turun kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "turkuKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      kaavalaji,
      municipality_code: null,
      region: municipality?.region ?? null,
      district_name: district,

      decision_status: kaavatilanne,
      documents_url: documentsUrl,

      description: fullDescription || null,

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
    municipality: municipality?.name ?? "Turku",
    kaavatilanne,
    phaseHint,
    classification,
  }
}
