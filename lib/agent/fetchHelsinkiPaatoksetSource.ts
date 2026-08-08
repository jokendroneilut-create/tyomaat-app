import { extractStreetAddress } from "./extractStreetAddress"
import { stripHtml } from "./stripHtml"

/*
 * Helsingin päätösjärjestelmä (Ahjo) Elasticsearch-proxyn kautta.
 *
 * Tämä lähde kattaa vaiheen jota meillä ei aiemmin ollut: kunnan NIMETYN
 * INVESTOINTIPÄÄTÖKSEN. Hanke on päätetty ja nimetty, mutta ei vielä
 * kilpailutettu — joten se ei näy Hilmassa eikä urakoitsijan tiedotteissa.
 * Aukko löytyi RPT:n hankelistaa läpikäymällä (ks. docs/rpt/README.md):
 * 552 puuttuvasta hankkeesta valtaosa oli juuri tässä vaiheessa.
 *
 * Rajapinta selvitettiin ajamalla haku selaimessa ja tallentamalla
 * fetch-kutsut — vanha Open Ahjo (dev.hel.fi/paatokset/v1) on kuollut, eikä
 * osoite ollut luettavissa minifioidusta bundlesta. Ei vaadi
 * tunnistautumista.
 *
 * Aineisto on poikkeuksellisen hyvä: subject sisältää nimen JA osoitteen,
 * decision_motion on esittelijän perustelut (mitattu 28 192 merkkiä: tausta,
 * tarve, laajuus, kustannus, aikataulu) ja unique_issue_id on pysyvä
 * tunniste täsmäytykseen.
 */
const SEARCH_URL =
  "https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search"

const RECENCY_MONTHS = 18

/*
 * Kategoriat ovat lähteen OMA luokittelu, joten suodatus ei nojaa
 * hakusana-arvailuun kuten STT:ssä (D-029). Mitatut määrät koko indeksistä
 * suluissa.
 *
 * Mukaan otetaan vain aito rakentaminen. Ulkopuolelle jäävät tarkoituksella:
 * tonttivuokraukset (4475), tilojen myynti ja vuokraus (3643), tilapäinen
 * käyttö (2633) — nämä eivät ole hankkeita — sekä asemakaavoitus (2450),
 * rakennusluvat (796) ja poikkeamismenettely (874), jotka meillä on jo
 * SUKKA- ja Lupapiste-lähteistä.
 */
const CATEGORIES = [
  "Rakennusten ja rakennelmien suunnittelu ja toteutus", // 1685
  "Alueiden kohdesuunnittelu, uudisrakentaminen ja peruskorjaus", // 922
  "Maa-alueiden rakentamiskelpoiseksi saattaminen", // 170
  "Purkaminen", // 143
]

/*
 * Kategoriasuodatus jättää läpi hallinnollisia päätöksiä jotka eivät ole
 * hankkeita. Mitattu otoksesta: 80 % kohinaa, ja se keskittyi muutamaan
 * toistuvaan muotoon.
 *
 * Kuviot ovat tarkkoja eivätkä yksittäisiä sanoja: "korvaus" yksin pudottaisi
 * myös aidon hankkeen "Suutarilan kirjaston KORVAAVAN uudisrakennuksen
 * hankesuunnitelma" - malli teki mitatusti juuri tuon virheen.
 */
const EXCLUDE_PATTERNS = [
  /tontille\s+maksettava\s+korvaus/i,
  /kustannusten\s+korvaaminen/i,
  /vahingonkorvau/i,
  /^\s*lausunto\b/i,
  /\blausunto\s+osoitteess/i,
  /aamukouluasia/i,
  /oikaisuvaatimu/i,
  /valitus\b/i,
  /\bvuokrasopimu/i,
  /määräalan\s+myynti/i,
]

export function shouldExclude(subject: string): boolean {
  return EXCLUDE_PATTERNS.some((re) => re.test(subject))
}

const PAGE_SIZE = 100
const MAX_PAGES = 20

/*
 * Vaihe päätellään otsikosta. Kunnan päätösketju on vakiintunut:
 * tarveselvitys -> hankesuunnitelma -> toteutussuunnitelma -> urakka.
 */
export function inferPhase(subject: string): string {
  const text = subject.toLowerCase()
  if (/urakka|urakoitsij|toteutussopimus/.test(text)) return "Sopimus myönnetty"
  if (/toteutussuunnitel|rakentamispäätös/.test(text)) return "Rakennuslupa"
  if (/hankesuunnitel/.test(text)) return "Suunnittelussa"
  if (/tarveselvit/.test(text)) return "Suunnittelu"
  return "Suunnittelussa"
}

/*
 * Perustelut ovat pitkiä ja alkavat vakiofraasilla. Kuvaukseen otetaan
 * päätösteksti ja perustelut yhdessä, koska päätösteksti yksin on usein
 * pelkkä "hyväksyi esityksen mukaisesti" - mitattu 704 merkkiä vs. 28 192.
 */
function buildDescription(content: string, motion: string): string | null {
  const parts = [stripHtml(content), stripHtml(motion)]
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const joined = parts.join(" ").replace(/\s+/g, " ").trim()
  return joined || null
}

export async function fetchHelsinkiPaatoksetSource() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)
  const cutoffUnix = Math.floor(cutoff.getTime() / 1000)

  const results: any[] = []
  const seen = new Set<string>()

  for (let page = 0; page < MAX_PAGES; page++) {
    let hits: any[] = []
    try {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        },
        body: JSON.stringify({
          query: {
            bool: {
              filter: [
                { terms: { category_name: CATEGORIES } },
                { range: { meeting_date: { gte: cutoffUnix } } },
              ],
            },
          },
          _source: [
            "subject",
            "issue_subject",
            "decision_content",
            "decision_motion",
            "decision_url",
            "organization_name",
            "meeting_date",
            "unique_issue_id",
            "category_name",
          ],
          sort: [{ meeting_date: "desc" }],
          size: PAGE_SIZE,
          from: page * PAGE_SIZE,
        }),
      })
      if (!res.ok) break
      const json = await res.json()
      hits = json?.hits?.hits ?? []
    } catch {
      break
    }

    if (hits.length === 0) break

    for (const hit of hits) {
      const s = hit?._source ?? {}
      const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

      const subject = String(first(s.subject) ?? "").trim()
      const relativeUrl = String(first(s.decision_url) ?? "").trim()
      if (!subject || !relativeUrl) continue

      if (shouldExclude(subject)) continue

      /*
       * Sama asia saa useita päätöksiä (esittely, päätös, muutoksenhaku).
       * unique_issue_id pitää ne yhtenä hankkeena - ilman tätä sama koulu
       * tulisi jonoon kolmesti.
       */
      const issueId = String(first(s.unique_issue_id) ?? relativeUrl)
      if (seen.has(issueId)) continue
      seen.add(issueId)

      const description = buildDescription(
        String(first(s.decision_content) ?? ""),
        String(first(s.decision_motion) ?? "")
      )

      results.push({
        name: subject,
        description,
        city: "Helsinki",
        region: "Uusimaa",
        /*
         * Osoite on tyypillisesti otsikon sulkeissa: "…perusparannuksen
         * hankesuunnitelma (Kenttäkuja 12, Pukinmäki)". Varalla koko
         * kuvaus.
         */
        location:
          extractStreetAddress(subject) ?? extractStreetAddress(description),
        developer: "Helsingin kaupunki",
        /*
         * Asiatunnus (HEL-2025-008563) on pysyvä ja yksilöivä, joten se
         * kelpaa tunnisteeksi täsmäytyksessä.
         */
        permit_number: issueId,
        property_type: null,
        phase: inferPhase(subject),
        business_value: "high",
        source_url: relativeUrl.startsWith("http")
          ? relativeUrl
          : `https://paatokset.hel.fi${relativeUrl}`,
        confidence: 0.6,
        completed: false,
        source_name: "helsinki_paatokset",
      })
    }

    if (hits.length < PAGE_SIZE) break
  }

  return results
}
