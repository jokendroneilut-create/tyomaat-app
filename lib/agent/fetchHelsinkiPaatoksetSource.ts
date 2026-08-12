import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { extractDecisionWinners } from "./decisionWinners"
import { inferDecisionPhase } from "./decisionPhase"
import { genericizeDecisionTitle } from "./decisionTitle"
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

/*
 * Ahjon `meeting_date` on unix-sekunteina, mutta aineistossa esiintyy myös
 * valmiiksi ISO-muotoinen merkkijono. Molemmat kelpaavat; mikä tahansa muu
 * palauttaa null, koska väärä päätöspäivä olisi pahempi kuin puuttuva -
 * sen perusteella hanke voitaisiin todeta vanhentuneeksi.
 */
export function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e11 ? value : value * 1000
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 10)
  }

  if (typeof value === "string") {
    const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (iso) return iso[1]

    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return toIsoDate(numeric)
  }

  return null
}

export async function fetchHelsinkiPaatoksetSource() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)

  /*
   * TUOREUSRAJA ISO-MUODOSSA, EI SEKUNTEINA.
   *
   * `meeting_date` on indeksissä date-kenttä, ja Elasticsearch tulkitsee
   * paljaan luvun EPOCH-MILLISEKUNNEIKSI. Sekunteina annettu raja
   * (1 739 401 512) tarkoitti sille 21.1.1970, joten se ei rajannut mitään:
   * mitattu 12.8.2026, sama kysely ilman suodatinta ja sekuntirajalla
   * palautti kummallakin 143 318 osumaa ja vanhin oli 23.1.2015.
   *
   * Rajan ei siis pitänyt vuotaa hieman - se ei ollut voimassa lainkaan,
   * ja lähde toi jonoon vuoteen 2015 asti vanhoja päätöksiä. Tämä on
   * suora syy siihen että jonossa oli 2021-vuoden asioita.
   *
   * ISO-merkkijono on yksiselitteinen eikä riipu yksikkötulkinnasta.
   * Mitattu korjauksen jälkeen: 25 943 osumaa, vanhin 13.2.2025.
   */
  const cutoffIso = cutoff.toISOString()

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
                { range: { meeting_date: { gte: cutoffIso } } },
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

      const winners = extractDecisionWinners(description)

      results.push({
        /*
         * PÄÄTÖSPÄIVÄ TALTEEN. `meeting_date` on haettu ES-vastauksessa
         * alusta asti (suodatus ja lajittelu käyttävät sitä), mutta sitä
         * ei ole tallennettu mihinkään. Ilman sitä emme tiedä milloin
         * päätös tehtiin - vain milloin ME näimme sen, eli vuonna 2021
         * tehty päätös näyttää tuoreelta jos se tuotiin kantaan tänään.
         *
         * Mitattu 12.8.2026: jonossa oli 108 riviä joiden asiatunnus on
         * vuodelta 2021 tai vanhempi, eikä ikää voinut mitata muuten kuin
         * arvaamalla asiatunnuksen vuodesta tai leipätekstistä.
         */
        metadata: { decision_date: toIsoDate(first(s.meeting_date)) },
        name: genericizeDecisionTitle(subject),
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
        property_type: inferBuildingType(subject, description),
        winners,
        /*
         * Helsingin otsikkopäättely on rikkaampi kuin muiden (hankesuunnitelma,
         * tarveselvitys, rakentamispäätös), joten se jää varalle sellaisenaan.
         */
        phase: inferDecisionPhase({
          description,
          hasWinner: winners.length > 0,
          fallback: inferPhase(subject),
          title: subject,
        }),
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
