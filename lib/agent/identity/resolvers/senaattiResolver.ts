import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { looksLikeCompany } from "@/lib/agent/companyName"
import { senaatinOsapuolet, senaatinTekijat } from "@/lib/agent/senaattiTekijat"

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
  /*
   * Uusi muoto on taulukko (nimi, nimike, SUORA puhelin, laajennettu
   * osoite) - vanha yhden objektin muoto sailytetaan, koska kannassa on
   * viela dokumentteja jotka on kerätty sillä.
   */
  const contacts: any[] = Array.isArray(metadata.contacts)
    ? metadata.contacts
    : metadata.contact
      ? [metadata.contact]
      : []

  const municipality = getMunicipalityByName(location)
  const phaseHint = mapSenaattiPhase(senaattiPhase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contacts.filter((c) => c?.name)

  /*
   * TEKIJALOHKO OSAPUOLIKSI (D-355).
   *
   * Johannes 27.10.2026: *"miksi tasta lahteesta ei ole poimittu
   * kaikkia hankkeeseen liittyvia yrityksia jotka on annettu?"*
   * Sivun koko sisalto on dokumentin omassa payloadissa, joten tama ei
   * vaadi yhtaan lisahakua.
   *
   * `developer` EI tule taalta: se on kovakoodattu Senaatiksi yllä
   * olevan kommentin mukaisesti, ja sivun "Rakennuttaja" voi olla
   * kayttajavirasto.
   */
  const tekijat = senaatinTekijat(document.raw_payload?.original?.content?.rendered ?? "")
  const osapuolet = senaatinOsapuolet(tekijat, looksLikeCompany)
  const { developer: _sivunRakennuttaja, ...tekijakentat } = osapuolet.kentat

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
      /*
       * Senaatti-kiinteistöt on valtion tilaajaorganisaatio, ei koskaan
       * fyysinen urakoitsija - approve-reitti lukee rakennuttajan
       * metadata.developer-kentästä, ei metadata.builder-kentästä.
       */
      developer: "Senaatti-kiinteistöt",
      senaatti_post_id: metadata.decision_index ?? null,
      region: municipality?.region ?? null,
      building_type: buildingType,

      decision_status: senaattiPhase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: contactPersons,

      ...tekijakentat,
      ...(osapuolet.liittyvat.length ? { related_companies: osapuolet.liittyvat } : {}),
      ...(osapuolet.monta.length ? { senaatti_monta_osahanketta: osapuolet.monta } : {}),
      ...(osapuolet.henkilot.length ? { senaatti_henkilot: osapuolet.henkilot } : {}),

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
