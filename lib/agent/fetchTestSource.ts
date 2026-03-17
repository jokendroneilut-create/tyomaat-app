import * as cheerio from "cheerio"
import { detectCityFromText } from "@/lib/agent/detectCityFromText"

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
  "rakentuu",
  "koulu",
  "päiväkoti",
  "hanke",
  "rakennetaan",
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