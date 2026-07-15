import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk28ToWgs84 } from "@/lib/geo/gk28"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveLappeenrantaKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const fieldPhase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
    metadata.contacts ?? []

  const municipality = getMunicipalityByName("Lappeenranta")

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? gk28ToWgs84(coordinates.x, coordinates.y)
      : null

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contacts
    .filter((c) => c.name)
    .map((c) => ({
      name: c.name,
      title: c.title ?? "Kaavoitus",
      phone: c.phone ?? null,
      email: c.email ?? null,
    }))

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Lappeenranta",
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "lappeenranta_kaava_id", value: document.document_url }],

    metadata: {
      source: "Lappeenrannan kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "lappeenrantaKaavaResolver",

      operation,
      region: municipality?.region ?? null,

      decision_status: fieldPhase,
      documents_url: document.document_url,

      description,
      contact_persons: contactPersons,

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
    municipality: municipality?.name ?? "Lappeenranta",
    fieldPhase,
    phaseHint,
    classification,
  }
}
