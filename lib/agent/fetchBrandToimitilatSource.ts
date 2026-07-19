import * as cheerio from "cheerio"
import { fetchRssFeed } from "./fetchRssFeed"
import { detectCityFromText } from "./detectCityFromText"

const FEED_URL = "https://brandtoimitilat.fi/feed/"

/*
 * Sivu on tämän yhtiön oma referenssisivusto, joten rakennuttaja
 * (urakoitsija) on aina sama — RSS-syöte tai artikkelisivu ei koskaan
 * anna erillistä rakennuttajakenttää.
 */
const BUILDER_NAME = "Brand toimitilat"
const DEFAULT_BUILDING_TYPE = "Toimitila"

const PROJECT_KEYWORDS = [
  "toimitilarakentaminen",
  "rakennamme",
  "rakentaa",
  "rakentuu",
  "rakensimme",
  "uusiin toimitiloihin",
  "toimitilaa",
  "valmistui",
  "valmistunut",
]

const EXCLUDE_KEYWORDS = [
  "aluejohtaja",
  "luottoluokitus",
  "myi kiinteistö",
  "rekry",
  "avoin työpaikka",
  "uusi toimistomme",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

/*
 * Artikkelisivun leipäteksti sisältää kaupungin nimen paljon
 * luotettavammin kuin RSS-otsikko/lyhyt kuvaus (esim. "Lempäälä" ei
 * esiinny otsikossa lainkaan, vain leipätekstissä). Sivun alalaidassa on
 * kuitenkin "Viimeisimmät"-palkki, joka listaa MUIDEN artikkeleiden
 * otsikoita — nekin saattavat mainita eri kaupunkeja, joten se leikataan
 * pois ennen kaupungin tunnistusta, jottei väärä kaupunki poimiudu
 * naapuriartikkelin otsikosta.
 */
async function fetchArticleBodyText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)
    $("script, style").remove()

    const fullText = $("body").text().replace(/\s+/g, " ").trim()
    return fullText.split(/viimeisimmät/i)[0]?.trim() || null
  } catch {
    return null
  }
}

export async function fetchBrandToimitilatSource() {
  const results: any[] = []
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  const items = await fetchRssFeed(FEED_URL)

  for (const item of items) {
    if (item.pubDate && item.pubDate < cutoffDate) continue

    const combinedText = `${item.title} ${item.description}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) continue
    if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) continue

    const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

    const bodyText = await fetchArticleBodyText(item.link)
    const city =
      detectCityFromText(item.title) ??
      (bodyText ? detectCityFromText(bodyText) : null) ??
      detectCityFromText(combinedText)

    results.push({
      name: item.title,
      city,
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: item.link,
      confidence: 0.6,
      completed,
      source_name: "brand_toimitilat",
      developer: BUILDER_NAME,
      building_type: DEFAULT_BUILDING_TYPE,
    })
  }

  return results
}
