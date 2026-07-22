import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function mapHaapavesiPhase(rawPhase: string | null): string {
  const normalized = (rawPhase ?? "").toLowerCase()
  if (/voimaantulo|lainvoima/.test(normalized)) return PHASE_LABELS.completed
  if (/hyväksy/.test(normalized)) return PHASE_LABELS.permit
  if (/ehdotu/.test(normalized)) return PHASE_LABELS.planning
  if (/luonno/.test(normalized)) return PHASE_LABELS.planning
  return PHASE_LABELS.zoning
}

export async function resolveHaapavesiKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const phase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const slug = document.raw_payload?.slug ?? null

  const completed = /voimaantulo|lainvoima/i.test(phase ?? "")
  const phaseHint = mapHaapavesiPhase(phase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: "Haapavesi",
    address: operation,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    identifiers: [{ type: "haapavesi_kaava_slug", value: slug }],

    metadata: {
      source: "Haapaveden kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "haapavesiKaavaResolver",

      operation,
      region: "Pohjois-Pohjanmaa",
      slug,

      decision_status: phase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: [],

      phase_hint: phaseHint,
      completed,

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
    municipality: "Haapavesi",
    phase,
    phaseHint,
    classification,
  }
}
