import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function mapLempaalaPhase(rawPhase: string | null): string {
  const normalized = (rawPhase ?? "").toLowerCase()
  if (/voimaan|lainvoima/.test(normalized)) return PHASE_LABELS.completed
  if (/hyväksy/.test(normalized)) return PHASE_LABELS.permit
  if (/ehdotus/.test(normalized)) return PHASE_LABELS.planning
  if (/luonnos/.test(normalized)) return PHASE_LABELS.planning
  if (/osallistumis|arviointi|arvionti/.test(normalized)) return PHASE_LABELS.planning
  return PHASE_LABELS.zoning
}

export async function resolveLempaalaKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? null
  const phase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const contacts = metadata.contacts ?? []

  const completed = /voimaan|lainvoima/i.test(phase ?? "")
  const phaseHint = mapLempaalaPhase(phase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: "Lempäälä",
    address: operation,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    identifiers: [{ type: "lempaala_kaava_slug", value: kaavaTunnus }],

    metadata: {
      source: "Lempäälän kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "lempaalaKaavaResolver",

      operation,
      region: "Pirkanmaa",
      kaava_tunnus: kaavaTunnus,

      decision_status: phase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: contacts,

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
    municipality: "Lempäälä",
    phase,
    phaseHint,
    classification,
  }
}
