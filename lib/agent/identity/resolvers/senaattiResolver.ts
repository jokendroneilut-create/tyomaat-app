import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function mapSenaattiPhase(rawPhase: string | null): string {
  const normalized = (rawPhase ?? "").toLowerCase()
  if (normalized === "valmistunut") return PHASE_LABELS.completed
  if (normalized === "rakennusvaihe") return PHASE_LABELS.construction
  if (normalized === "suunnittelu") return PHASE_LABELS.planning
  return PHASE_LABELS.planning
}

export async function resolveSenaattiProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const senaattiPhase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const location = metadata.location ?? null
  const buildingType = metadata.building_type ?? null
  const description = metadata.description ?? null
  const contact: { name: string | null; title: string | null; email: string | null } | null =
    metadata.contact ?? null

  const municipality = getMunicipalityByName(location)
  const phaseHint = mapSenaattiPhase(senaattiPhase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contact?.name
    ? [
        {
          name: contact.name,
          title: contact.title ?? "Senaatti-kiinteistöt",
          phone: null,
          email: contact.email,
        },
      ]
    : []

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? location,
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "senaatti_project_id", value: String(metadata.decision_index ?? "") }],

    metadata: {
      source: "Senaatti-kiinteistöt",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "senaattiResolver",

      operation,
      builder: "Senaatti-kiinteistöt",
      senaatti_post_id: metadata.decision_index ?? null,
      region: municipality?.region ?? null,
      building_type: buildingType,

      decision_status: senaattiPhase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: contactPersons,

      phase_hint: phaseHint,

      construction_type: classification.construction_type,
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
    municipality: municipality?.name ?? location,
    senaattiPhase,
    phaseHint,
    classification,
  }
}
