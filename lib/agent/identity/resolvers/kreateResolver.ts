import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS, normalizeLegacyPhase } from "@/lib/projects/phases"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveKreateProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const kreateStatus = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const category = metadata.category ?? null
  const contacts: { title: string | null; name: string | null; phone: string | null; email: string | null }[] =
    metadata.contacts ?? []

  const inferredMunicipality = inferMunicipalityFromText(operation)

  /*
   * Kreaten oma "Käynnissä"/"Valmistuneet" -tila on jo kanoninen
   * vaihenimi (ks. kreatePhaseFromStatusNames apiCollector.ts:ssä), joten
   * sitä ei tarvitse päätellä uudelleen — jos se puuttuu, oletetaan
   * rakenteilla-vaihe koska Kreate listaa vain jo sovittuja urakoita,
   * ei suunnitteluvaiheen hankkeita.
   */
  const phaseHint =
    normalizeLegacyPhase(kreateStatus) != null ? kreateStatus! : PHASE_LABELS.construction

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contacts
    .filter((c) => c.name)
    .map((c) => ({
      name: c.name,
      title: c.title,
      phone: c.phone,
      email: c.email,
    }))

  const result = await resolvePotentialProject({
    title: operation,
    municipality: inferredMunicipality?.name ?? null,
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "kreate_project_id", value: String(metadata.decision_index ?? "") }],

    metadata: {
      source: "Kreate",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "kreateResolver",

      operation,
      builder: "Kreate",
      kreate_post_id: metadata.decision_index ?? null,
      region: inferredMunicipality?.region ?? null,
      building_type: category,

      decision_status: kreateStatus,
      documents_url: document.document_url,
      source_url: document.document_url,

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
    municipality: inferredMunicipality?.name ?? null,
    kreateStatus,
    phaseHint,
    classification,
  }
}
