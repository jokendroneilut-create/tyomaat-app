import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { gk25ToWgs84 } from "@/lib/geo/gk25"
import { kaavanPeruskuvaus } from "@/lib/agent/kaavanPeruskuvaus"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveVantaaKaavaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const kaavaTunnus = findFact(facts, "kaava_tunnus")?.fact_value ?? null
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const vaihe = findFact(facts, "decision_status")?.fact_value ?? null
  const kaavalinkki = findFact(facts, "documents_url")?.fact_value ?? null
  const kasitPvm = findFact(facts, "decision_date")?.fact_date ?? null
  const hakija = findFact(facts, "developer")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const contactPersons = metadata.contacts ?? []
  const municipality = getMunicipalityByName("Vantaa")

  /*
   * KUVAUS LUETAAN KAAVAN SIVULTA, JA JOS SIVUA EI OLE, SE
   * KIRJOITETAAN RAJAPINNAN KENTISTA.
   *
   * `kaavalinkki` on tyhja 7 kaavalla 98:sta (mitattu 31.10.2026),
   * eika niille tule kuvausta lainkaan. Rivi on silti aito hanke --
   * Vantaan virallisessa vireillä olevien kaavojen tasossa, geometria
   * mukana -- ja puuttuva tieto ei ole peruste piilottaa
   * ([[hiding-threshold]]).
   *
   * Peruskuvaus ei paattele mitaan: se kertoo tunnuksen, kohteen,
   * vaiheen ja OAS-paivan, eli juuri sen mita rajapinta antaa.
   */
  const description =
    metadata.description ??
    kaavanPeruskuvaus({
      kunta: "Vantaa",
      kaavaTunnus: kaavaTunnus,
      nimi: operation,
      vaihe,
      oasPvm: metadata.oas_pvm ?? null,
    })

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
    municipality: municipality?.name ?? "Vantaa",
    // Kaavan nimi on usein katuosoite/paikannimi eikä lähde tarjoa muuta osoitetta.
    address: operation,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "vantaa_kaava_tunnus", value: kaavaTunnus }],

    metadata: {
      source: "Vantaan kaavoitus",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "vantaaKaavaResolver",

      operation,
      kaava_tunnus: kaavaTunnus,
      municipality_code: null,
      region: municipality?.region ?? null,

      decision_status: vaihe,
      documents_url: kaavalinkki,
      date_published: kasitPvm,

      /*
       * "Hakija" Vantaan kaavan omalta sivulta — usein vain "Yksityinen"
       * tai "Yritys", joskus yrityksen nimi. Ei henkilön yhteystietoja,
       * mutta paras saatavilla oleva signaali siitä kuka hanketta ajaa.
       */
      developer: hakija,

      /*
       * Kaavan omalta sivulta poimitut kaupungin yhteyshenkilöt
       * (kaavoittaja/arkkitehti) — ei hakijan omia yhteystietoja,
       * mutta paras saatavilla oleva suora kontakti hankkeeseen.
       */
      contact_persons: contactPersons,

      /*
       * Kaavan sivun kuvausteksti (sijainti, kaavamuutoksen sisältö,
       * osallistaminen, päätöskäsittely) — sisältää usein arvokkaita
       * päivämääriä. approve-reitti käyttää tätä additional_info-kentän
       * lähteenä, jos description on asetettu.
       */
      description,

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
    municipality: municipality?.name ?? "Vantaa",
    vaihe,
    hakija,
    phaseHint,
    classification,
  }
}
