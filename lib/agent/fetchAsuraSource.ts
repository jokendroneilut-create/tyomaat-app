import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

export async function fetchAsuraSource() {
  const res = await fetch("https://www.asura.fi/ajankohtaista")
  const html = await res.text()

  const $ = cheerio.load(html)
  const results: any[] = []

  $("a").each((_, el) => {
  const title = $(el).text().trim()
  const href = $(el).attr("href")

  if (title.toLowerCase() === "lue lisää") return

  if (!title || !href) return

  const absoluteHref = href.startsWith("http")
    ? href
    : `https://www.asura.fi${href}`

  if (!absoluteHref.includes("/ajankohtaista/")) return
  if (absoluteHref === "https://www.asura.fi/ajankohtaista") return
  if (absoluteHref === "https://www.asura.fi/ajankohtaista/") return
  if (/^\d+$/.test(title)) return

const completedKeywords = [
  "valmistui",
  "valmistunut",
  "luovutettu",
  "otettu käyttöön",
]

const lowerTitle = title.toLowerCase()

const completed = completedKeywords.some((k) =>
  lowerTitle.includes(k)
)
  
  results.push({
    name: title,
    city: detectCityFromText(title),
    region: null,
    location: null,
    phase: completed ? "Valmistunut" : "Suunnittelussa",
    source_url: absoluteHref,
    confidence: 0.6,
    completed,
    source_name: "asura",
  })
})

  return results
}