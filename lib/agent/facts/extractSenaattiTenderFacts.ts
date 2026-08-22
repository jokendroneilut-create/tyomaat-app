import type { Contact } from "@/lib/projects/contacts"

export type ExtractedFact = {
  fact_type: string
  fact_key?: string | null
  fact_value?: string | null
  fact_number?: number | null
  fact_date?: string | null
  confidence: number
  metadata?: Record<string, any>
}

function clean(value: unknown) {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/*
 * SENAATIN KILPAILUTUSKALENTERIN RIVI FAKTOIKSI.
 *
 * Ajankohta kulkee tekstinä ("2027/Q1"), EI `fact_date`-kenttänä. Sitä
 * päivämäärää ei ole olemassa: Senaatti ilmoittaa neljänneksen, ja
 * keksitty "2027-01-01" näyttäisi käyttäjälle tarkemmalta kuin tieto on.
 *
 * Ks. `lib/agent/senaattiTenderCalendar.ts` siitä miksi tämä lähde on
 * poikkeuksellinen.
 */
export function extractSenaattiTenderFacts({
  documentId,
  sourceName,
  title,
  category,
  expectedPublication,
  scope,
  contacts,
  moreInfo,
}: {
  documentId: string
  sourceName: string
  title: string | null
  category: string | null
  expectedPublication: string | null
  scope: string | null
  contacts?: Contact[] | null
  moreInfo?: string | null
}): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  const commonMetadata = {
    source_document_id: documentId,
    source_name: sourceName,
    parser: "senaattiTenderParser",

    decision_index: clean(title) ?? "senaatti-tender",

    category: clean(category),
    expected_publication: clean(expectedPublication),
    scope: clean(scope),
    contacts: Array.isArray(contacts) ? contacts : [],
    more_info: clean(moreInfo ?? null),
  }

  if (title) {
    facts.push({
      fact_type: "operation",
      fact_key: "title",
      fact_value: title,
      confidence: 0.9,
      metadata: commonMetadata,
    })
  }

  if (expectedPublication) {
    facts.push({
      fact_type: "tender_expected_publication",
      fact_key: "ennakoitu_julkaisuajankohta",
      fact_value: expectedPublication,
      /*
       * Matalampi varmuus kuin otsikolla: rivi on ennuste ja voi siirtyä.
       */
      confidence: 0.6,
      metadata: commonMetadata,
    })
  }

  return facts
}
