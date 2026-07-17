import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveJarvenpaaKaavaProject({
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
  const address = metadata.address ?? null
  const decisionNumber = metadata.decision_number ?? null
  const description = metadata.description ?? null
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
    metadata.contacts ?? []

  const municipality = getMunicipalityByName("Järvenpää")

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    address,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Järvenpää",
    address: address ?? operation,
    propertyId: null,
    permitNumber: decisionNumber,

    sourceName: document.source_name,

    identifiers: [{ type: "jarvenpaa_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Järvenpään kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "jarvenpaaKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      decision_number: decisionNumber,
      region: municipality?.region ?? null,

      decision_status: fieldPhase,
      documents_url: document.document_url,

      description,
      contact_persons: contacts,

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
    municipality: municipality?.name ?? "Järvenpää",
    fieldPhase,
    phaseHint,
    classification,
  }
}
