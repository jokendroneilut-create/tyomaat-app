import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveSipooKaavaProject({
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

  const municipality = getMunicipalityByName("Sipoo")

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Sipoo",
    // Kaavan nimi on usein paikannimi eikä lähde tarjoa muuta osoitetta.
    address: operation,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    identifiers: [{ type: "sipoo_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Sipoon kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "sipooKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      region: municipality?.region ?? null,

      decision_status: fieldPhase,
      documents_url: document.document_url,

      description,

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
    municipality: municipality?.name ?? "Sipoo",
    fieldPhase,
    phaseHint,
    classification,
  }
}
