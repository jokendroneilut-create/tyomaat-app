import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { korjaaLiimattuKuvaus } from "@/lib/agent/rovaniemenKuvaus"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveRovaniemiKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const raw = document.raw_payload ?? {}

  /*
   * JAATYNYT KAAVA EI OLE EHDOKAS (D-417). Keraaja merkitsee "stale"
   * kun viimeisin vaihe on yli kaksi vuotta vanha, ja tarkoitus oli
   * ettei siita synny ehdokasta. 12.11.2026 jonoon tuli silti 28
   * jaatynytta kaavaa kerralla -- ilman faktoja, joten kuvaus,
   * kaavatunnus ja yhteystiedot olivat tyhjia.
   */
  if (raw.stale === true) {
    return {
      action: "skipped_stale",
      potentialProjectId: null,
      title: document.title ?? null,
      kaavaTunnus: raw.kaava_tunnus ?? null,
      municipality: "Rovaniemi",
      fieldPhase: raw.phase ?? null,
      phaseHint: PHASE_LABELS.zoning,
      classification: null,
    }
  }

  /*
   * FAKTAT PUUTTUVAT -> DOKUMENTISTA (D-417). Kaikki tieto on myos
   * dokumentin raw_payloadissa; ilman tata tyhja faktalista tuotti
   * ehdokkaan jolla jokainen kentta oli null.
   */
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? raw.kaava_tunnus ?? null
  const operation = findFact(facts, "operation")?.fact_value ?? raw.title ?? document.title
  const fieldPhase = findFact(facts, "decision_status")?.fact_value ?? raw.phase ?? null

  const metadata = facts[0]?.metadata ?? {
    address: raw.address ?? null,
    decision_number: raw.decision_number ?? null,
    description: raw.description ?? null,
    processing_steps: raw.processing_steps ?? null,
    contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
  }
  const address = metadata.address ?? null
  const decisionNumber = metadata.decision_number ?? null
  const processingSteps = metadata.processing_steps ?? null
  /*
   * Lohkossa voi olla monta henkiloa (D-409). Vanha yhden kentan muoto
   * luetaan yha, jotta ennen muutosta tallennetut faktat toimivat.
   */
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
    Array.isArray(metadata.contacts)
      ? metadata.contacts
      : metadata.contact
        ? [metadata.contact]
        : []

  const description = [korjaaLiimattuKuvaus(metadata.description), processingSteps ? `Käsittelyvaiheet: ${processingSteps}` : null]
    .filter(Boolean)
    .join(" ") || null

  const contactPersons = contacts
    .filter((c) => c?.name)
    .map((c) => ({
      name: c.name,
      title: c.title,
      phone: c.phone,
      email: c.email,
    }))

  const municipality = getMunicipalityByName("Rovaniemi")

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    address,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Rovaniemi",
    address: address ?? operation,
    propertyId: null,
    permitNumber: decisionNumber,

    sourceName: document.source_name,

    identifiers: [{ type: "rovaniemi_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Rovaniemen kaupunkisuunnittelu",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "rovaniemiKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      decision_number: decisionNumber,
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
    municipality: municipality?.name ?? "Rovaniemi",
    fieldPhase,
    phaseHint,
    classification,
  }
}
