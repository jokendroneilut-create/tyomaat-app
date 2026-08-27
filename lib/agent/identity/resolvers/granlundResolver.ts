import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

/*
 * GRANLUNDIN HANKE HANKKEEKSI.
 *
 * Granlund on SUUNNITTELIJA, ei urakoitsija. Se ei siis mene
 * `builder`-kenttaan kuten Kreate ja Lujatalo omilla sivuillaan, vaan
 * liittyviin yrityksiin roolinsa kanssa - muuten hankkeelle kirjautuisi
 * vaara paaurakoitsija.
 *
 * Vaihe on suunnittelu, ei rakentaminen: Granlund on mukana vuosia ennen
 * tyomaata. Prisma Hyllykalliossa suunnittelu alkoi 2024 ja rakentaminen
 * 2026. Valmistuneet on jo suodatettu keraajassa.
 */
export async function resolveGranlundProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const metadata = facts[0]?.metadata ?? {}

  const city: string | null = metadata.city ?? null
  const developer: string | null = metadata.developer ?? null
  const description: string | null = metadata.description ?? null

  /*
   * Paikkakunta tulee lahteesta rakenteisena kenttana (100 %), joten sita
   * ei tarvitse paatella tekstista. Paattely on varalla siina
   * epatodennakoisessa tapauksessa etta kentta puuttuu.
   */
  const inferred = city
    ? inferMunicipalityFromText(city)
    : inferMunicipalityFromText(operation)

  const classification = classifyProject({
    operation,
    title: operation,
    description: description ?? undefined,
  })

  const roolit: string[] = Array.isArray(metadata.granlund_services)
    ? metadata.granlund_services
    : []

  const relatedCompanies = [
    roolit.length ? `Granlund (${roolit.join(", ").toLowerCase()})` : "Granlund (suunnittelu)",
    ...(Array.isArray(metadata.other_companies) ? metadata.other_companies : []),
  ]

  const result = await resolvePotentialProject({
    title: operation,
    municipality: inferred?.name ?? city ?? null,
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [
      { type: "granlund_post_id", value: String(metadata.granlund_post_id ?? "") },
    ],

    metadata: {
      source: "Granlund",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "granlundResolver",

      operation,
      region: inferred?.region ?? null,
      documents_url: document.document_url,
      source_url: document.document_url,

      ...(description ? { description } : {}),
      ...(developer ? { developer } : {}),
      ...(metadata.area_text ? { laajuus: metadata.area_text } : {}),
      ...(metadata.project_type ? { construction_type_text: metadata.project_type } : {}),
      ...(metadata.estimated_completion
        ? { estimated_completion: metadata.estimated_completion }
        : {}),
      ...(metadata.start_year ? { design_start_year: metadata.start_year } : {}),

      related_companies: relatedCompanies,

      /*
       * Suunnitteluvaihe, ei rakentaminen. Granlund on mukana ennen
       * tyomaata, ja vaarin merkitty vaihe siirtaisi hankkeen elinkaarella
       * eteenpain kuin se on.
       */
      phase_hint: PHASE_LABELS.planning,

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
    municipality: inferred?.name ?? city ?? null,
    developer,
    classification,
  }
}
