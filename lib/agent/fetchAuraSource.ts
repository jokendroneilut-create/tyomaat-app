import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

export async function fetchAuraSource() {
  const res = await fetch("https://aurarakennus.fi/ajankohtaista/")
  const html = await res.text()

  const $ = cheerio.load(html)
  const results: any[] = []

 $("h3").each((_, el) => {
  const title = $(el).text().trim()
  const href = $(el).find("a").attr("href")

  if (!title || !href) return

  const absoluteHref = href.startsWith("http")
    ? href
    : `https://aurarakennus.fi${href}`

  const projectKeywords = [
    "rakentaa",
    "rakennamme",
    "rakentaminen",
    "rakentuu",
    "toteuttaa",
    "hanke",
    "kerrostalo",
    "asunto",
    "kohde",
    "luovutettu",
    "luovutti",
    "käynnistynyt",
  ]

  const lower = title.toLowerCase()

  if (!projectKeywords.some((k) => lower.includes(k))) {
    return
  }

  const completedKeywords = [
    "luovutettu",
    "valmistunut",
    "valmistui",
  ]

  const completed = completedKeywords.some((k) => lower.includes(k))

  results.push({
    name: title,
    city: detectCityFromText(title),
    region: null,
    location: null,
    phase: completed ? "Valmistunut" : "Suunnittelussa",
    source_url: absoluteHref,
    confidence: 0.6,
    completed,
    source_name: "aura",
  })
})

  return results
}