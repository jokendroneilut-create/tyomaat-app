import { detectCityFromText } from "./detectCityFromText"
import { stripHtml } from "./stripHtml"
import { extractStreetAddress } from "./extractStreetAddress"

/*
 * SRV:n oma "ajankohtaista"-sivu on Gatsby-sovellus, jonka HTML ei
 * sisällä artikkelisisältöä (ladataan asiakaspuolella). Sivun
 * build-aikainen data-JSON kuitenkin sisältää KAIKKI Cision-tiedotteet
 * valmiiksi jäsenneltynä.
 *
 * SIJOITTAJAUUTISIA EI SAA SULKEA POIS. Aiemmin tässä vaadittiin
 * kategoria Type002 ("Lehdistötiedote") sillä perusteella että
 * sijoittajatiedotteet ovat hallinnollisia. Se päättely oli väärä:
 * pörssiyhtiölle merkittävä voitettu urakka ON olennainen tieto
 * sijoittajille, joten juuri suurimmat urakkavoitot julkaistaan
 * Type004:nä ("Sijoittajauutinen").
 *
 * Mitattu 15.8.2026: kahden vuoden ikkunassa 241 suomenkielistä
 * tiedotetta, joista 165 on hankemaisia — mutta Type002-ehto päästi
 * läpi vain 81. Pois jäi mm. "SRV toteuttaa historiallisen
 * Hämeenlinnan Lyseon peruskorjauksen" (sopimuksen arvo 21,5 M€) ja
 * "SRV toteuttaa monitoimiareenan Kouvolaan" (18 M€) — molemmat
 * Type004.
 *
 * Rajaus tehdään nyt sisällöllä (PROJECT_KEYWORDS / EXCLUDE_KEYWORDS)
 * eikä julkaisukanavalla, sekä sulkemalla pois johdon
 * liiketoimi-ilmoitukset joissa ei koskaan ole hanketta.
 */
const PAGE_DATA_URL =
  "https://www.srv.fi/page-data/srv-yrityksena/ajankohtaista/page-data.json"

const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakennus",
  "rakentaminen",
  "rakentuu",
  "toteuttaa",
  "toteutti",
  "toteuttavat",
  "valmistui",
  "valmistunut",
  "peruskorjaa",
  "peruskorjaus",
  "käynnist",
  "investointipäätös",
  "sopimuksen",
  "sopimus",
  "asuntoa",
  "asunnon",
  "asuntoja",
  "asuinkerrostalo",
  "kerrostalo",
  "monitoimitalo",
  "päiväkoti",
  "koulu",
  "sairaala",
  "hotelli",
  "toimitila",
  "datakeskus",
  "hanke",
]

const EXCLUDE_KEYWORDS = [
  "osavuosikatsaus",
  "puolivuosikatsaus",
  "vuosikertomus",
  "tilinpäätös",
  "yhtiökokous",
  "johdon liiketoim",
  "sisäpiiri",
  "osakkeenomistaj",
  "optio-oikeus",
  "johtajaksi",
  "kilpailussa",
  "palkittu",
  "onnettomu",
  "hankintakieltoon",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchSrvSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  const res = await fetch(PAGE_DATA_URL)
  if (!res.ok) return results

  const json = await res.json()
  const nodes = json?.result?.data?.allCisionDetailNodes?.nodes ?? []

  for (const node of nodes) {
    const d = node?.data
    if (!d) continue
    if (d.LanguageCode !== "fi") continue

    /*
     * Type003 = "Johdon liiketoimet" (MAR-ilmoitus osakekaupoista). Ainoa
     * kategoria jossa ei voi olla hanketta; kaikki muut päästetään läpi ja
     * sisältö ratkaisee.
     */
    const categories: { Code?: string; Name?: string }[] = d.Categories ?? []
    if (categories.some((c) => c.Code === "Type003")) continue

    const title = (d.Title ?? "").trim()
    const url = (d.CanonicalUrl ?? "").trim() || d.CisionWireUrl
    if (!title || !url) continue
    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    const dateMatch = (d.PublishDate ?? "").match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})/
    )
    if (dateMatch) {
      const [, day, month, year] = dateMatch
      const articleDate = new Date(Number(year), Number(month) - 1, Number(day))
      if (articleDate < cutoffDate) continue
    }

    const body = (d.Body ?? d.Intro ?? "").toString()
    const combinedText = `${title} ${body}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) continue
    if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) continue

    const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

    /*
     * Kaupunki haetaan ensisijaisesti otsikosta — koko tiedotteen
     * runko mainitsee usein sivulauseessa muitakin kaupunkeja
     * (esim. yhtiön yleiskuvaus), jolloin ensimmäinen osuma rungosta
     * olisi usein väärä.
     */
    /*
     * Cisionin runko on HTML. Se laskettiin avainsanasuodatusta varten mutta
     * jäi pois palautuksesta, joten kaikki 291 ehdokasta syntyivät ilman
     * kuvausta - ja 96 % hylättiin, koska pelkän otsikon perusteella korttia
     * ei voi arvioida. Runko on tiedotteen koko teksti: kohteen nimi,
     * asuntomäärä, aikataulu ja tilaaja.
     */
    const description = stripHtml(body) || null

    results.push({
      name: title,
      description,
      city: detectCityFromText(title) ?? detectCityFromText(combinedText),
      region: null,
      location: extractStreetAddress(description),
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: url,
      confidence: 0.6,
      completed,
      source_name: "srv",
    })
  }

  return results
}
