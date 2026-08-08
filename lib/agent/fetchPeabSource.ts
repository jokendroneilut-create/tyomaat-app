import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import {
  createCompanyEnricher,
  inferCompanyPhase,
  inferBuildingType,
} from "./companyRelease"

/*
 * Peabin tiedotteet. Listaussivulta saadaan vain otsikko ja osoite;
 * varsinainen sisältö haetaan tiedotesivulta jaetulla enrich-koukulla
 * (companyRelease.ts), joka on sama kaikilla yrityslähteillä.
 *
 * Tämä lähde korjattiin ensimmäisenä, ja siitä yleistettiin jaettu moduuli.
 * Alkuperäinen vika: ehdokas syntyi tyhjänä ja vaihe arvattiin otsikosta,
 * jolloin urakan jo saanut hanke merkittiin suunnitteluvaiheeseen.
 */

const BASE = "https://www.peab.fi"

const PROJECT_KEYWORDS = [
  "rakentaa", "rakentaminen", "rakentuu", "toteuttaa", "peruskorjaus",
  "peruskorjauksen", "peruskorjaa", "hanke", "kohde", "asunto", "asuntoa",
  "asunnot", "kodit", "kortteli", "toimitila", "toimitilat", "koulu",
  "päiväkoti", "sairaala", "datakeskus", "teollisuus", "liikuntahalli",
  "kehitysvaihe", "uudis", "korjausrakennushanke", "urakka", "urakan",
]

const EXCLUDE_KEYWORDS = [
  "nimity", "osavuosikatsaus", "tilinpäätös", "markkina", "tulos",
  "työturvallisuuskilpailu", "sertifikaatin", "leed",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "luovutettu", "otettu käyttöön"]

export const enrichPeabCandidate = createCompanyEnricher({ publisher: "Peab" })

export async function fetchPeabSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 1; page <= 5; page++) {
    const url =
      page === 1
        ? `${BASE}/peab/ajankohtaista/`
        : `${BASE}/peab/ajankohtaista/?page=${page}`

    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    $("a").each((_, el) => {
      const title = $(el).text().trim()
      const href = $(el).attr("href")
      if (!title || !href) return

      const absoluteHref = href.startsWith("http") ? href : `${BASE}${href}`
      if (!absoluteHref.includes("/peab/media/tiedotteet/")) return
      if (/^\d+$/.test(title)) return

      const lowerTitle = title.toLowerCase()
      if (!PROJECT_KEYWORDS.some((k) => lowerTitle.includes(k))) return
      if (EXCLUDE_KEYWORDS.some((k) => lowerTitle.includes(k))) return

      const dateMatch = $(el).text().match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
      if (dateMatch) {
        const [day, month, year] = dateMatch[1].split(".").map(Number)
        if (new Date(year, month - 1, day) < cutoffDate) return
      }

      if (seenUrls.has(absoluteHref)) return
      seenUrls.add(absoluteHref)

      const completed = COMPLETED_KEYWORDS.some((k) => lowerTitle.includes(k))

      results.push({
        name: title,
        description: null,
        city: detectCityFromText(title),
        /* Maakunta johdetaan kunnasta tuonnissa (importCandidate). */
        region: null,
        location: null,
        /*
         * Otsikkopohjainen arvaus. enrich() korvaa tämän leipätekstistä
         * pääteltävällä vaiheella; tämä jää voimaan vain jos sivuhaku
         * epäonnistuu tai täydennysbudjetti loppuu kesken.
         */
        phase: inferCompanyPhase(title, null),
        property_type: inferBuildingType(title, null),
        builder: "Peab",
        source_url: absoluteHref,
        confidence: 0.6,
        completed,
        source_name: "peab",
      })
    })
  }

  return results
}
