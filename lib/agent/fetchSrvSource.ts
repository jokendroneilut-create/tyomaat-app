import { detectCityFromText } from "./detectCityFromText"

/*
 * SRV:n oma "ajankohtaista"-sivu on Gatsby-sovellus, jonka HTML ei
 * sisällä artikkelisisältöä (ladataan asiakaspuolella). Sivun
 * build-aikainen data-JSON kuitenkin sisältää KAIKKI Cision-tiedotteet
 * (myös pörssitiedotteet ym.) valmiiksi jäsenneltynä — suodatetaan
 * niistä suomenkieliset ja Type002 "Lehdistötiedote" -kategoriaan
 * kuuluvat, jolloin sijoittaja-/hallintotiedotteet jäävät pois.
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

    const categories: { Code?: string; Name?: string }[] = d.Categories ?? []
    const isPressRelease = categories.some((c) => c.Code === "Type002")
    if (!isPressRelease) continue

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
    results.push({
      name: title,
      city: detectCityFromText(title) ?? detectCityFromText(combinedText),
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: url,
      confidence: 0.6,
      completed,
      source_name: "srv",
    })
  }

  return results
}
