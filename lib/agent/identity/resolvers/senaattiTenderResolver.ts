import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"
import { SENAATTI_TENDER_CALENDAR_URL } from "@/lib/agent/senaattiTenderCalendar"

/*
 * SENAATIN KILPAILUTUSKALENTERIN RIVI HANKKEEKSI.
 *
 * Rivi on ENNUSTE tulevasta kilpailutuksesta, ei päätös. Siksi:
 *
 *   - vaihe on aina "Suunnitteilla"; kilpailutusta ei väitetä alkaneeksi
 *   - ajankohta säilytetään neljänneksenä ("2027/Q1") eikä muunneta
 *     päivämääräksi jota ei ole olemassa
 *   - kuvaus sanoo suoraan että kyseessä on ennakkotieto, jottei
 *     käyttäjä luule kilpailutuksen olevan auki
 *
 * Ks. `lib/agent/senaattiTenderCalendar.ts` siitä miksi tämä lähde on
 * poikkeuksellinen: se on ainoa joka kertoo hankkeesta ENNEN julkaisua.
 */

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveSenaattiTenderProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const metadata = facts[0]?.metadata ?? {}

  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const expected: string | null = metadata.expected_publication ?? null
  const scope: string | null = metadata.scope ?? null
  const category: string | null = metadata.category ?? null
  const contacts: any[] = Array.isArray(metadata.contacts) ? metadata.contacts : []

  const inferredMunicipality = inferMunicipalityFromText(operation)

  const classification = classifyProject({ operation, title: operation })

  /*
   * Kuvaus kirjoitetaan auki, koska pelkkä otsikko ei kerro että kyse on
   * tulevasta kilpailutuksesta. Tämä on koko lähteen arvo.
   */
  const description = [
    `Senaatti-kiinteistöjen kilpailutuskalenterissa ennakkotietona ilmoitettu tuleva kilpailutus.`,
    expected ? `Ennakoitu julkaisuajankohta: ${expected}.` : null,
    scope ? `Hankinnan laajuus: ${scope}.` : null,
    category ? `Hankintakategoria: ${category}.` : null,
    `Kilpailutusta ei ole vielä julkaistu, ja ajankohta voi muuttua.`,
  ]
    .filter(Boolean)
    .join(" ")

  const result = await resolvePotentialProject({
    title: operation,
    municipality: inferredMunicipality?.name ?? null,
    address: null,
    propertyId: null,
    permitNumber: null,
    sourceName: document.source_name,

    identifiers: [{ type: "senaatti_tender_id", value: document.document_url }],

    metadata: {
      source: "Senaatti-kiinteistöt kilpailutuskalenteri",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "senaattiTenderResolver",

      operation,
      developer: "Senaatti-kiinteistöt",
      region: inferredMunicipality?.region ?? null,

      /* Neljännes sellaisenaan — ei keksitä päivämäärää. */
      tender_expected_publication: expected,
      tender_scope: scope,
      tender_category: category,

      documents_url: SENAATTI_TENDER_CALENDAR_URL,
      source_url: document.document_url,

      description,
      contact_persons: contacts,

      /*
       * Aina suunnitteilla: kalenteri kertoo mitä aiotaan kilpailuttaa,
       * ei mitä on kilpailutettu.
       */
      phase_hint: PHASE_LABELS.planning,

      building_type: classification.building_type ?? "Julkinen rakennus",
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
    expectedPublication: expected,
    classification,
  }
}
