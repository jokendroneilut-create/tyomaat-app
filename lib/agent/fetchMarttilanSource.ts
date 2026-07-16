import { fetchRssFeed } from "./fetchRssFeed"
import { detectCityFromText } from "./detectCityFromText"

const FEED_URL = "https://www.marttilan.fi/feed/"

/*
 * Otsikot ovat usein pelkkä paikannimi ("Otsolahti, Espoo") — varsinainen
 * urakka-/hanketieto on ingressissä, joten avainsanat tarkistetaan
 * otsikko+ingressi-yhdistelmästä. Yleisluontoinen "Urakointitiedotteet"-
 * kokoomasivu ja ala-/koulutusartikkelit ("Miten talvi vaikuttaa...")
 * suljetaan pois erikseen.
 */
const PROJECT_KEYWORDS = ["urakka", "urakointitiedote", "hanke", "valmistui", "valmistunut"]

const EXCLUDE_KEYWORDS = ["urakointitiedotteet", "miten ", "mitä ", "miksi "]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchMarttilanSource() {
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

    results.push({
      name: item.title,
      city: detectCityFromText(item.title) ?? detectCityFromText(combinedText),
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: item.link,
      confidence: 0.6,
      completed,
      source_name: "marttilan",
    })
  }

  return results
}
