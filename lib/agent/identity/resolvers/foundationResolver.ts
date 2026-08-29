import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { displayPhaseLabel } from "@/lib/projects/phases"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

/*
 * ASUNTOSÄÄTIÖN TIEDOTE HANKKEEKSI.
 *
 * Kaksi asiaa erottaa tämän muista resolvereista.
 *
 * 1. RAKENNUTTAJA TIEDETÄÄN VARMASTI. Se on säätiö itse, ei päätelty
 *    tekstistä. Siksi se menee `developer`-kenttään täydellä
 *    luottamuksella.
 *
 * 2. SAMA HANKE TULEE MONTA KERTAA. Ensihaku, harjannostajaiset ja
 *    valmistuminen ovat kolme tiedotetta samasta kohteesta — AYY:llä
 *    viisi. Ne sidotaan yhteen osoitteella (`project_name`), joka on
 *    tunniste eikä pelkkä otsikko. Ilman sitä yhdestä hankkeesta
 *    syntyisi viisi ehdokasta.
 */
export async function resolveFoundationProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const metadata = facts[0]?.metadata ?? {}

  const projectName: string | null = metadata.project_name ?? null
  const developer: string | null = metadata.developer ?? null
  const builder: string | null = metadata.builder ?? null

  /*
   * Kaupunki päätellään tiedotteen tekstistä. Osoite yksin ei riitä:
   * "Otakaari 15" ei kerro kuntaa, mutta leipätekstissä lukee
   * Otaniemi/Espoo.
   */
  const inferred = inferMunicipalityFromText(`${operation} ${document.raw_text ?? ""}`)

  const classification = classifyProject({
    operation,
    title: projectName ?? operation,
    description: operation,
  })

  const result = await resolvePotentialProject({
    /*
     * Otsikoksi osoite, ei tiedotteen otsikko. Tiedotteen otsikko
     * vaihtuu joka kerta ("harjannostajaisia juhlistettiin"), osoite ei.
     */
    title: projectName ?? operation,
    municipality: inferred?.name ?? null,
    address: projectName,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: projectName
      ? [{ type: "foundation_project_name", value: projectName }]
      : [],

    metadata: {
      source: document.source_name,
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "foundationResolver",

      operation,
      region: inferred?.region ?? null,
      documents_url: document.document_url,
      source_url: document.document_url,

      ...(developer ? { developer } : {}),
      ...(builder ? { builder } : {}),
      ...(metadata.apartments ? { apartments: metadata.apartments } : {}),
      ...(metadata.floor_area ? { floor_area: metadata.floor_area } : {}),
      ...(metadata.estimated_completion
        ? { estimated_completion: metadata.estimated_completion }
        : {}),

      /*
       * Vaihe tulee tiedotteen teosta. Puuttuva vaihe jätetään
       * asettamatta: väärä vaihe siirtäisi hankkeen elinkaarella.
       */
      ...(metadata.phase_hint
        ? { phase_hint: displayPhaseLabel(metadata.phase_hint) }
        : {}),

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
    municipality: inferred?.name ?? null,
    developer,
    classification,
  }
}
