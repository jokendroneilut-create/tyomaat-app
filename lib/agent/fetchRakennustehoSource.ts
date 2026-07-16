import { fetchRssFeed } from "./fetchRssFeed"
import { detectCityFromText } from "./detectCityFromText"

const FEED_URL = "https://rakennusteho.fi/feed/"

const PROJECT_KEYWORDS = [
  "rakennetaan",
  "rakentaa",
  "rakensi",
  "valmistui",
  "valmistunut",
  "hanke",
  "monitoimitalo",
  "koulu",
  "päiväkoti",
  "kortteli",
  "peruskorjaus",
  "peruskivi",
  "harjannostajaiset",
  "urakka",
]

const EXCLUDE_KEYWORDS = [
  "rekry",
  "avoin työpaikka",
  "vuosikertomus",
  "tilinpäätös",
  "toimitusjohtaja",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchRakennustehoSource() {
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
      source_name: "rakennusteho",
    })
  }

  return results
}
