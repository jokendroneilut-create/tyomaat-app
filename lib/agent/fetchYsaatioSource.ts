import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Y-Säätiön "Uutiset"-listaus (WordPress, sivutus /ajankohtaista/sivu/N/).
 * Feedi sekoittaa rakennushankeuutisia sosiaalityö-/tapahtumasisältöön,
 * joten avainsanasuodatus on tarpeen (vain otsikko käytettävissä
 * listaussivulla, ei erillistä ingressiä).
 */
const BASE_URL = "https://ysaatio.fi/ajankohtaista/"

/*
 * Y-Säätiön otsikoissa "rakenn"/"hanke"/"kiinteistö" esiintyvät myös
 * kuvaannollisesti sosiaalityöhankkeissa ("rakennetaan arkea yhdessä",
 * "Jiippi-hanke päättyy") — siksi vaaditaan täsmällisempiä, oikeasti
 * uudisrakentamiseen viittaavia ilmauksia.
 */
const PROJECT_KEYWORDS = [
  "rakennutti",
  "rakennuttaa",
  "rakennuttamis",
  "uutta kotia",
  "uusia koteja",
  "uuden kodin",
  "peruskorjaus",
  "peruskorjattu",
  "peruskorjaa",
  "uudisrakennus",
  "harjannostajaiset",
  "harjakorkeu",
  "peruskivi",
  "kerrostalo",
  "rivitalo",
]

const EXCLUDE_KEYWORDS = [
  "vuosikertomus",
  "tilinpäätös",
  "hallituksen jäsen",
  "toimitusjohtaja",
  "suomiareena",
  "koulutus",
  "webinaari",
  "seminaari",
  "sidosryhmätilaisuus",
  "hanke päättyy",
  "rakennetaan arkea",
  "rakennetaan uudenlaista arkea",
  "myy ",
  "myynyt",
  "arvonimen",
  "rakennusneuvos",
  "organisaatiouudistus",
  "presidentti",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "avattiin", "avattu"]

export async function fetchYsaatioSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 1; page <= 5; page++) {
    const url =
      page === 1
        ? `${BASE_URL}?_category_list=uutinen`
        : `${BASE_URL}sivu/${page}/?_category_list=uutinen`

    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    const items = $(".single-item")
    if (items.length === 0) break

    items.each((_, el) => {
      const $el = $(el)
      const link = $el.find("a.single-item__link").first()
      const title =
        link.find(".single-item__title").first().text().trim() ||
        link.attr("title")?.trim() ||
        ""
      const href = link.attr("href")

      if (!title || !href) return
      if (seenUrls.has(href)) return
      seenUrls.add(href)

      const dateText = $el.find(".single-item__meta-item").first().text().trim()
      const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)

      if (dateMatch) {
        const [, day, month, year] = dateMatch
        const articleDate = new Date(Number(year), Number(month) - 1, Number(day))
        if (articleDate < cutoffDate) return
      }

      const combinedText = title.toLowerCase()

      if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) return
      if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) return

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
        source_name: "ysaatio",
      })
    })
  }

  return results
}
