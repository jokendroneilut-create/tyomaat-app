import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function mapToholampiPhase(rawPhase: string | null): string {
  const normalized = (rawPhase ?? "").toLowerCase()
  if (/voimaantulo|lainvoima/.test(normalized)) return PHASE_LABELS.zoning
  if (/hyväksy/.test(normalized)) return PHASE_LABELS.zoning
  if (/ehdotu/.test(normalized)) return PHASE_LABELS.zoning
  if (/luonno/.test(normalized)) return PHASE_LABELS.zoning
  return PHASE_LABELS.zoning
}

export async function resolveToholampiKaavaProject({
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
  const contacts = metadata.contacts ?? []
  /* OAS:n aloitteentekijä rakennuttajaksi (D-450). */
  const developer = metadata.developer ?? null
  const asiakirjaUrl = metadata.asiakirja_url ?? null
  const slug = document.raw_payload?.slug ?? null

  const completed = false
  const phaseHint = mapToholampiPhase(phase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: "Toholampi",
    address: operation,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    /*
     * Asiakirjan osoite toiseksi tunnisteeksi (D-450): kunta muutti nimen
     * "Datakeskuksen alueen asemakaava" -> "Datakeskuksen alueen/
     * Kiertokangas asemakaava", jolloin nimestä tehty slug vaihtui ja
     * samasta kaavasta syntyi uusi jonorivi. OAS-liite pysyi samana.
     */
    identifiers: [
      { type: "toholampi_kaava_slug", value: slug },
      ...(asiakirjaUrl ? [{ type: "kaava_asiakirja_url" as const, value: asiakirjaUrl }] : []),
    ],

    metadata: {
      source: "Toholammin kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "toholampiKaavaResolver",

      operation,
      region: "Keski-Pohjanmaa",
      slug,

      decision_status: phase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: contacts,
      ...(developer
        ? {
            developer,
            related_companies: [developer],
            field_sources: { developer: "OAS: kaavoitus on tullut vireille yhtiön aloitteesta" },
          }
        : {}),
      ...(asiakirjaUrl ? { oas_url: asiakirjaUrl } : {}),

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
    municipality: "Toholampi",
    phase,
    phaseHint,
    classification,
  }
}
