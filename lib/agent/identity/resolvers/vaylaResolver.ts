import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

function mapVaylaPhase(rawPhase: string | null): string {
  const normalized = (rawPhase ?? "").toLowerCase()
  if (normalized === "valmistunut") return PHASE_LABELS.completed
  if (normalized === "käynnissä") return PHASE_LABELS.construction
  if (normalized === "suunnitteilla") return PHASE_LABELS.planning
  return PHASE_LABELS.planning
}

export async function resolveVaylaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const vaylaPhase = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const hankeType = metadata.hanke_type ?? null
  const region = metadata.region ?? null
  const description = metadata.description ?? null
  const contact: { organization: string | null; title: string | null; name: string | null; phone: string | null; email: string | null } | null =
    metadata.contact ?? null
  const progress = metadata.progress ?? null

  /*
   * Väylävirasto antaa vain maakunnan (alue), ei kuntaa — kunta yritetään
   * päätellä otsikko-/kuvaustekstistä samalla tavalla kuin Hilmalla ja
   * Kreatella (esim. "Vt 23 Karvion kohta" -> "Heinävesi" kuvauksesta).
   */
  const inferredMunicipality = inferMunicipalityFromText(`${operation} ${description ?? ""}`)

  const phaseHint = mapVaylaPhase(vaylaPhase)

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const contactPersons = contact?.name
    ? [
        {
          name: contact.name,
          title: contact.title ?? contact.organization,
          phone: contact.phone,
          email: contact.email,
        },
      ]
    : []

  const fullDescription = [
    description,
    progress ? `Aikataulu: ${progress}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const result = await resolvePotentialProject({
    title: operation,
    municipality: inferredMunicipality?.name ?? null,
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "vayla_project_id", value: document.document_url }],

    metadata: {
      source: "Väylävirasto",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "vaylaResolver",

      operation,
      /*
       * Väylävirasto on aina tilaaja/rakennuttaja, ei koskaan fyysinen
       * urakoitsija - approve-reitti lukee rakennuttajan metadata.developer-
       * kentästä, joten se kirjoitetaan tähän eikä harhaanjohtavaan
       * metadata.builder-kenttään (jota mikään koodi ei muutenkaan lue).
       */
      developer: "Väylävirasto",
      region: region ?? inferredMunicipality?.region ?? null,
      construction_type: hankeType,

      decision_status: vaylaPhase,
      documents_url: document.document_url,
      source_url: document.document_url,

      description: fullDescription || null,
      contact_persons: contactPersons,

      phase_hint: phaseHint,

      /*
       * classifyProject() on viritetty rakennusten (kerrostalo, koulu jne.)
       * tunnistamiseen tekstistä eikä koskaan tunnista tie-/silta-/rata-
       * hankkeita - ilman oletusarvoa nämä jäisivät aina kohdetyypittä.
       * Kaikki Väylävirasto-lähteen sisältö on infrahanketta, joten se
       * kelpaa yleiseksi oletukseksi kun tarkempaa tyyppiä ei tunnistettu.
       */
      building_type: classification.building_type ?? "Infrahanke",
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
    vaylaPhase,
    phaseHint,
    classification,
  }
}
