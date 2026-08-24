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

  /*
   * PROJEKTINJOHTAJA KENTTALOHKOSTA.
   *
   * Poikkeus saantoon "nimi ilman sahkopostia tai puhelinta ei ole
   * yhteystieto". Mitattu 25.8.2026: 75 Kreate-rivista 32:lla on
   * Projektinjohtaja-kentta, ja 30 heista on jo henkilostoosiossa
   * sahkoposteineen — lisays koskee siis kaytannossa yhta hanketta.
   *
   * Omistajan paatos: nimi on silti hyva tieto, vaikka siihen ei voi
   * ottaa suoraan yhteytta. Myyja tietaa kenesta kysya.
   *
   * VAIN LISAYS, ei korvaus: jos henkilo on jo listalla (yleensa on,
   * yhteystietoineen), hanta ei lisata uudelleen nimena.
   */
  const projektinjohtaja: string | null = metadata.project_manager ?? null
  if (
    projektinjohtaja &&
    !contactPersons.some(
      (c) => String(c.name ?? "").toLowerCase() === projektinjohtaja.toLowerCase()
    )
  ) {
    contactPersons.push({
      name: projektinjohtaja,
      title: "Projektinjohtaja",
      phone: null,
      email: null,
    })
  }

  /*
   * Kentat tulevat hankesivun rakenteisesta lohkosta (ks.
   * lib/agent/kreateProject.ts). Rakenteinen arvo on parempi kuin
   * proosasta paattely: mitattuna 41/41 vastaan 20/41.
   *
   * estimated_completion menee metadataan, ja resolvePotentialProject
   * levittaa input.metadatan OMAN paattelynsa jalkeen - eli lahteen oma
   * kentta voittaa arvauksen ilman erillista koodia.
   */
  const kuvaus: string | null = metadata.description ?? null
  const osoite: string | null = metadata.project_address ?? null
  const valmistuminen: string | null = metadata.estimated_completion ?? null

  const result = await resolvePotentialProject({
    title: operation,
    municipality: inferredMunicipality?.name ?? null,
    address: osoite,
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

      ...(kuvaus ? { description: kuvaus } : {}),
      ...(osoite ? { project_address: osoite } : {}),
      ...(valmistuminen ? { estimated_completion: valmistuminen } : {}),
      ...(metadata.completion_text ? { completion_text: metadata.completion_text } : {}),
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
