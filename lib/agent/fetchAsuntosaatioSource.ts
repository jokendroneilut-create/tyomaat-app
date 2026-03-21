import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

export async function fetchAsuntosaatioSource() {
  const res = await fetch("https://www.asuntosaatio.fi/tiedotteet/")
const html = await res.text()

const $ = cheerio.load(html)
const results: any[] = []

$("a").each((_, el) => {
  const title = $(el).text().trim()
  const href = $(el).attr("href")

  if (!title || !href) return

  const absoluteHref = href.startsWith("http")
    ? href
    : `https://www.asuntosaatio.fi${href}`

  // 🔥 ensin URL-filter
  if (!absoluteHref.includes("/tiedotteet/")) return
  if (absoluteHref === "https://www.asuntosaatio.fi/tiedotteet/") return

  // 🔥 sitten poista numerot
  if (/^\d+$/.test(title)) return

  // 🔥 sitten keyword-filter
  const projectKeywords = [
    "rakennushanke",
    "rakentaa",
    "rakentaminen",
    "rakentuu",
    "asumisoikeus",
    "asumisoikeusasunto",
    "kohde",
    "kerrostalo",
    "kortteli",
    "uudiskohde",
    "uudiskohteen",
    "uudisasunto",
    "uudisasunnot",
    "valmistunut",
    "valmistuu",
  ]

  const lowerTitle = title.toLowerCase()

  if (!projectKeywords.some((k) => lowerTitle.includes(k))) {
    return
  }

  results.push({
    name: title,
    city: detectCityFromText(title),
    region: null,
    location: null,
    phase: "Suunnittelussa",
    source_url: absoluteHref,
    confidence: 0.6,
    completed: false,
    source_name: "asuntosaatio",
  })
})

return results
}