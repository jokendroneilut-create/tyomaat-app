import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function capitalize(value: string | null): string | null {
  if (!value) return null
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export async function resolveJoensuuKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const rawStatus = findFact(facts, "decision_status")?.fact_value ?? null
  const fieldPhase = capitalize(rawStatus)

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const district = metadata.district ?? null
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
    metadata.contacts ?? []

  const municipality = getMunicipalityByName("Joensuu")

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
    municipality: municipality?.name ?? "Joensuu",
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "joensuu_kaava_id", value: document.document_url }],

    metadata: {
      source: "Joensuun kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "joensuuKaavaResolver",

      operation,
      district_name: district,
      region: municipality?.region ?? null,

      decision_status: fieldPhase,
      documents_url: document.document_url,

      description,
      contact_persons: contactPersons,

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
    municipality: municipality?.name ?? "Joensuu",
    fieldPhase,
    phaseHint,
    classification,
  }
}
