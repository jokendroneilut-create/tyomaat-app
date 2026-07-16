import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Varten blogikortit on jo valmiiksi luokiteltu tunnisteella
 * ("Projektit" / "Varte-kodit" / "Työpaikat") — käytetään suoraan
 * "Projektit"-tunnistetta suodattimena avainsana-arvailun sijaan.
 */
const URL = "https://www.varte.fi/varte/ajankohtaista"

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchVarteSource() {
  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  const res = await fetch(URL)
  if (!res.ok) return results

  const html = await res.text()
  const $ = cheerio.load(html)

  $(".blog-card").each((_, el) => {
    const $el = $(el)
    const tag = $el.find(".blog-card-tags span").first().text().trim()
    if (tag !== "Projektit") return

    const title = $el.find(".blog-card__title").first().text().trim()
    const href = $el.find("a.blog-card__link").first().attr("href")
    if (!title || !href) return

    const dateText = $el
      .find(".blog-card__author span")
      .last()
      .text()
      .trim()
    const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)

    if (dateMatch) {
      const [, day, month, year] = dateMatch
      const articleDate = new Date(Number(year), Number(month) - 1, Number(day))
      if (articleDate < cutoffDate) return
    }

    const combinedText = title.toLowerCase()
    const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

    results.push({
      name: title,
      city: detectCityFromText(title),
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: href,
      confidence: 0.6,
      completed,
      source_name: "varte",
    })
  })

  return results
}
