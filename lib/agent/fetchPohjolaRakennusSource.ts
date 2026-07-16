import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Ei päivämäärää listaussivulla (n. 19 sivua koko historiaa) — rajataan
 * vain muutamaan tuoreimpaan sivuun, source_url-pohjainen
 * duplicate_source-tarkistus estää uudelleenkäsittelyn.
 */
const BASE_URL = "https://www.pohjolarakennus.fi/category/uutiset/"

const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakensi",
  "rakennuttaa",
  "käynnisti",
  "aloitti",
  "valmistui",
  "valmistunut",
  "pääurakoitsijaksi",
  "ennakkomarkkinoinnin",
  "uutta kotia",
  "uusia koteja",
  "asuinkerrostalo",
  "kerrostalo",
  "asuntoa",
]

const EXCLUDE_KEYWORDS = [
  "rekry",
  "avoin työpaikka",
  "vuosikertomus",
  "tilinpäätös",
  "nimitetty",
  "toimitusjohtajaksi",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

export async function fetchPohjolaRakennusSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= 4; page++) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`

    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    const items = $(".c-story-item")
    if (items.length === 0) break

    items.each((_, el) => {
      const $el = $(el)
      const href = $el.find("a.c-story-item__link").first().attr("href")
      const title = $el.find(".c-story-item__title").first().text().trim()
      const excerpt = $el.find(".c-story-item__excerpt").first().text().trim()

      if (!title || !href) return
      if (seenUrls.has(href)) return
      seenUrls.add(href)

      const combinedText = `${title} ${excerpt}`.toLowerCase()

      if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) return
      if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) return

      const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

      results.push({
        name: title,
        city: detectCityFromText(title) ?? detectCityFromText(combinedText),
        region: null,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: href,
        confidence: 0.6,
        completed,
        source_name: "pohjola_rakennus",
      })
    })
  }

  return results
}
