import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Mangroven "Ajankohtaista"-sivu lataa koko historian yhdellä kertaa
 * yhteen HTML-vastaukseen — "Lataa lisää" -nappi vain paljastaa CSS:llä
 * piilotettuja ("piiloitettu") artikkeleita, jotka ovat silti jo
 * DOM:issa. Erillistä sivutusta ei siis tarvita.
 */
const LISTING_URL = "https://www.mangrove.fi/ajankohtaista/"

const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakentaminen",
  "rakentuu",
  "rakensi",
  "toteuttaa",
  "toteutti",
  "toteuttavat",
  "valmistui",
  "valmistunut",
  "valmistuivat",
  "luovutti",
  "luovutettiin",
  "käynnist",
  "urakkasopimus",
  "urakoi",
  "asunnon",
  "asuntoa",
  "asuntoja",
  "asuinkerrostalo",
  "kerrostalo",
  "rivitalo",
  "vuokrakerrostalo",
  "vuokrarivitalo",
  "vuokrakoti",
  "vuokra-asunto",
  "asumisoikeus",
]

const EXCLUDE_KEYWORDS = [
  "joulua",
  "joulun",
  "joululahjoituksen",
  "toimitusjohtaja",
  "nimity",
  "kannattavuus",
  "osavuosikatsaus",
  "strategiset valinnat",
  "vastuullisuusraportti",
  "ilmasto-ohjelma",
  "eettiset ohjeet",
  "ilmoituskanava",
  "asiakastyytyväisyys",
  "työturvallisuusviikko",
  "turvallisuusviikko",
  "turvavartti",
  "osti ohjelmistoyhtiö",
  "laajentaa rakentamispalvelujaan",
  "arvomaailma",
  "tiimipäivä",
  "haluamme olla panostamassa",
]

const COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "valmistuivat",
  "luovutti",
  "luovutettiin",
  "otettu käyttöön",
]

export async function fetchMangroveSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  const res = await fetch(LISTING_URL)
  if (!res.ok) return results

  const html = await res.text()
  const $ = cheerio.load(html)

  $(".artikkeli-sisalto").each((_, el) => {
    const $el = $(el)
    const link = $el.find("h2 a, h3 a").first()
    const title = link.text().trim()
    const href = link.attr("href")

    if (!title || !href) return
    if (seenUrls.has(href)) return
    seenUrls.add(href)

    const dateText = $el.find(".artikkeli-pvm").first().text().trim()
    const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)

    if (dateMatch) {
      const [, day, month, year] = dateMatch
      const articleDate = new Date(Number(year), Number(month) - 1, Number(day))
      if (articleDate < cutoffDate) return
    }

    const description = $el
      .find("p")
      .not(".artikkeli-pvm")
      .first()
      .text()
      .trim()

    const combinedText = `${title} ${description}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) return
    if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) return

    const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

    results.push({
      name: title,
      city: detectCityFromText(combinedText),
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: href,
      confidence: 0.6,
      completed,
      source_name: "mangrove",
    })
  })

  return results
}
