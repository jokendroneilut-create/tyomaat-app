import { YRITYSTIEDOTTEEN_IKKUNA_KK } from "@/lib/agent/tiedotteenIkkuna"
import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Varten blogikortit on jo valmiiksi luokiteltu tunnisteella
 * ("Projektit" / "Varte-kodit" / "Työpaikat") — käytetään suoraan
 * "Projektit"-tunnistetta suodattimena avainsana-arvailun sijaan.
 */
const URL = "https://www.varte.fi/varte/ajankohtaista"

const HANKETUNNISTEET = ["Projektit", "Urakat"]

const COMPLETED_KEYWORDS =["valmistui", "valmistunut"]

export async function fetchVarteSource() {
  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)

  const res = await fetch(URL)
  if (!res.ok) return results

  const html = await res.text()
  const $ = cheerio.load(html)

  $(".blog-card").each((_, el) => {
    const $el = $(el)
    /*
     * "Urakat" tuli kayttoon lokakuussa 2026: LOAS Baletti (57 asuntoa,
     * 7.10.2026) oli merkitty vain sillä, ja pelkka "Projektit" pudotti
     * sen. Hanke loytyi vasta kuvakaappauksesta.
     */
    const tag = $el.find(".blog-card-tags span").first().text().trim()
    if (!HANKETUNNISTEET.includes(tag)) return

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
