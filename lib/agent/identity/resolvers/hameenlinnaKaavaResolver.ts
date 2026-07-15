import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveHameenlinnaKaavaProject({
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
  const contactName = metadata.contact_name ?? null

  const municipality = getMunicipalityByName("Hämeenlinna")

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contactName
    ? [
        {
          name: contactName,
          title: "Kaavoitus",
          phone: null,
          email: null,
        },
      ]
    : []

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Hämeenlinna",
    /*
     * Lähde ei anna erillistä osoitekenttää eikä per-hanke-koordinaatteja
     * — kaavan nimi on kuitenkin käytännössä useimmiten katuosoite tai
     * paikannimi (esim. "Vanajantie 7"), joten käytetään sitä osoitteena
     * tyhjän sijaan.
     */
    address: operation,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "hameenlinna_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Hämeenlinnan kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "hameenlinnaKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
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
    kaavaTunnus,
    municipality: municipality?.name ?? "Hämeenlinna",
    fieldPhase,
    phaseHint,
    classification,
  }
}
