import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

export async function fetchBonavaSource() {
  const res = await fetch("https://www.bonava.fi/tietoa-meista/media")
  const html = await res.text()

  const $ = cheerio.load(html)
  const results: any[] = []

  $("a.news-list__row").each((_, el) => {
    const title = $(el)
      .find(".list-primitive__cell")
      .eq(1)
      .text()
      .replace(/^Otsikko\s*/i, "")
      .trim()

    const href = $(el).attr("href")

    if (!title || !href) return

    // 🔴 estetään roska (varmuuden vuoksi)
    if (title.length < 10) return

    const absoluteHref = href.startsWith("http")
      ? href
      : `https://www.bonava.fi${href}`

    const projectKeywords = [
      "rakentaa",
      "rakentaminen",
      "rakentuu",
      "asuinkortteli",
      "kortteli",
      "asunto",
      "asunnot",
      "koti",
      "kodit",
      "hanke",
      "kohde",
      "alue",
    ]

    const lower = title.toLowerCase()

    if (!projectKeywords.some((k) => lower.includes(k))) {
      return
    }

    const completedKeywords = [
      "valmistui",
      "valmistunut",
      "luovutettu",
      "luovutti",
    ]

    const completed = completedKeywords.some((k) =>
      lower.includes(k)
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
      source_name: "bonava",
    })
  })

  return results
}