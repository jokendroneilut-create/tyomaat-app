import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk25ToWgs84 } from "@/lib/geo/gk25"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveHelsinkiKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? null
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const luokka = findFact(facts, "decision_status")?.fact_value ?? null
  const siteAreaM2 = findFact(facts, "site_area_m2")?.fact_number ?? null
  const selostusUrl = findFact(facts, "documents_url")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const municipality = getMunicipalityByName("Helsinki")

  const coordinates = metadata.coordinates ?? null
  const wgs84 =
    coordinates && typeof coordinates.x === "number" && typeof coordinates.y === "number"
      ? gk25ToWgs84(coordinates.x, coordinates.y)
      : null

  const phaseHint = PHASE_LABELS.zoning

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? "Helsinki",
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "helsinki_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Helsingin kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "helsinkiKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      municipality_code: metadata.district_code ?? null,
      region: municipality?.region ?? null,
      district_name: metadata.district_name ?? null,

      decision_status: luokka,
      date_published: null,

      /*
       * Helsingin vireillä-rajapinnassa itsessään ei ole hakijan nimeä,
       * yhteystietoja eikä kuvaustekstiä toisin kuin Vantaalla — vain
       * kaavatunnus, vaihe, pinta-ala ja sijainti. Kuvausteksti haetaan
       * kaavan omasta asemakaavaselostus-PDF:stä (ks. apiCollector.ts:n
       * fetchHelsinkiKaavaSelostus), joka on julkinen niin kauan kuin kaava
       * on vielä vireillä.
       */
      site_area_m2: siteAreaM2,
      description,
      documents_url: selostusUrl,

      lupapiste_coordinates: coordinates,
      lupapiste_coordinates_wgs84: wgs84,

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
    municipality: municipality?.name ?? "Helsinki",
    luokka,
    siteAreaM2,
    phaseHint,
    classification,
  }
}
