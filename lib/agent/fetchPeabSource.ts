import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

export async function fetchPeabSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 1; page <= 5; page++) {
    const url =
      page === 1
  ? "https://peab.fi/peab/ajankohtaista/"
  : `https://peab.fi/peab/ajankohtaista/?page=${page}`
    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    $("a").each((_, el) => {
      const title = $(el).text().trim()
const href = $(el).attr("href")

      if (!title || !href) return

      const absoluteHref = href.startsWith("http")
        ? href
        : `https://www.peab.fi${href}`

      if (!absoluteHref.includes("/peab/media/tiedotteet/")) return
      if (/^\d+$/.test(title)) return

      const lowerTitle = title.toLowerCase()

      const projectKeywords = [
        "rakentaa",
        "rakentaminen",
        "rakentuu",
        "toteuttaa",
        "peruskorjaus",
        "peruskorjauksen",
        "hanke",
        "kohde",
        "asunto",
        "asuntoa",
        "asunnot",
        "kodit",
        "kortteli",
        "toimitila",
        "toimitilat",
        "koulu",
        "päiväkoti",
        "sairaala",
        "datakeskus",
        "teollisuus",
        "liikuntahalli",
        "kehitysvaihe",
        "uudis",
        "korjausrakennushanke",
      ]

      const excludeKeywords = [
        "nimity",
        "osavuosikatsaus",
        "tilinpäätös",
        "markkina",
        "tulos",
        "työturvallisuuskilpailu",
        "sertifikaatin",
        "leed",
      ]

      if (!projectKeywords.some((k) => lowerTitle.includes(k))) return
      if (excludeKeywords.some((k) => lowerTitle.includes(k))) return

      const dateText = $(el).text()
      const dateMatch = dateText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
      if (dateMatch) {
        const [day, month, year] = dateMatch[1].split(".").map(Number)
        const articleDate = new Date(year, month - 1, day)
        if (articleDate < cutoffDate) return
      }

      const completedKeywords = [
        "valmistui",
        "valmistunut",
        "luovutettu",
        "otettu käyttöön",
      ]

      const completed = completedKeywords.some((k) =>
        lowerTitle.includes(k)
      )
if (seenUrls.has(absoluteHref)) return
seenUrls.add(absoluteHref)

      results.push({
        name: title,
        city: detectCityFromText(title),
        region: null,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: absoluteHref,
        confidence: 0.6,
        completed,
        source_name: "peab",
      })
    })
  }

  return results
}