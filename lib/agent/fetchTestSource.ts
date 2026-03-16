import * as cheerio from "cheerio"

export type FetchedCandidate = {
  name: string
  city: string | null
  region: string | null
  location: string | null
  phase: string
  source_url: string | null
  confidence?: number
  completed?: boolean
  source_name: string
}
function detectCityFromText(text: string): string | null {
  const cities = [
    "helsinki",
    "espoo",
    "vantaa",
    "tampere",
    "turku",
    "oulu",
    "jyväskylä",
    "lahti",
    "kuopio",
    "raisio",
    "kempele",
    "ylöjärvi",
    "hämeenlinna",
    "pori",
    "joensuu",
    "lappeenranta",
    "kerava",
    "tuusula",
    "järvenpää",
  ]

  const lower = text.toLowerCase()

const cityAliases: Record<string, string> = {
  "kempeleessä": "Kempele",
  "ylöjärvellä": "Ylöjärvi",
  "hämeenlinnan": "Hämeenlinna",
}

for (const [alias, city] of Object.entries(cityAliases)) {
  if (lower.includes(alias)) return city
}

for (const city of cities) {
  const regex = new RegExp(`\\b${city}(ssa|ssä|sta|stä|seen|lla|llä|lta|ltä|lle|na|nä|n|in)?\\b`, "i")
  if (regex.test(lower)) {
    return city.charAt(0).toUpperCase() + city.slice(1)
  }
}

  return null
}
export async function fetchTestSource(): Promise<FetchedCandidate[]> {
  const res = await fetch("https://lapti.fi/ajankohtaista/")
  const html = await res.text()

  const $ = cheerio.load(html)
  const results: FetchedCandidate[] = []

  for (const el of $("h3").toArray()) {
    const title = $(el).text().trim()
    if (!title) continue
const projectKeywords = [
  "rakentaminen",
  "rakennus",
  "koulu",
  "päiväkoti",
  "hanke",
  "rakennetaan",
  "rakentuu",
  "avautuu",
  "laajennus",
  "sairaala",
  "palvelukeskus",
]
const lowerTitle = title.toLowerCase()

if (!projectKeywords.some(k => lowerTitle.includes(k))) {
  continue
}
    const readMoreLink =
  $(el).closest("article").find("a").first().attr("href") ||
  $(el).parent().find("a").first().attr("href") ||
  $(el).nextAll("a").first().attr("href") ||
  null
    const href = readMoreLink
      ? readMoreLink.startsWith("http")
        ? readMoreLink
        : `https://lapti.fi${readMoreLink}`
      : null

    let city: string | null = null

if (href) {
  try {
    const articleRes = await fetch(href)
    const articleHtml = await articleRes.text()
    const article$ = cheerio.load(articleHtml)
     const articleText =
  article$("article").first().text().trim() ||
  article$("main").first().text().trim() ||
  ""

city = detectCityFromText(title) || detectCityFromText(articleText)
  } catch (err) {
    console.error("Article fetch failed:", href, err)
  }
}
const completionKeywords = [
  "valmistui",
  "valmistunut",
  "avautui",
  "avautuu käyttöön",
  "otetaan käyttöön",
  "käyttöön",
]

const lowerContent = `${title} ${href ?? ""}`.toLowerCase()
const completed = completionKeywords.some((k) => lowerContent.includes(k))
results.push({
  
  name: title,
  city,
  region: null,
  location: null,
  phase: "Suunnittelussa",
  source_url: href,
  confidence: 0.8,
  completed,
  source_name: "lapti",
})
  }

  return results
}