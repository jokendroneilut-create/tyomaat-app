import { fetchRssFeed } from "./fetchRssFeed"
import { detectCityFromText } from "./detectCityFromText"

const FEED_URL = "https://hausia.fi/feed/"

const PROJECT_KEYWORDS = [
  "rakentaminen on alkanut",
  "rakentaa",
  "rakennuttaa",
  "valmistui",
  "valmistunut",
  "jatkosuunnittelijaksi",
  "urakoitsijaksi",
  "kokonaisurakkaa",
  "asuntoa",
  "asuntoja",
  "kerrostalo",
  "peruskivi",
  "harjannostajaiset",
]

const EXCLUDE_KEYWORDS = [
  "tunnustus",
  "menestyjät",
  "työturvallisuus",
  "rekry",
  "avoin työpaikka",
  "vuosikertomus",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchHausiaSource() {
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
      source_name: "hausia",
    })
  }

  return results
}
