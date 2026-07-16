import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Rajukivi Oy (infra-/maanrakennusurakoitsija) — WordPress/Divi-teema,
 * "Ajankohtaista"-luokan sivutus /category/aajankohtaista/page/N/
 * (huom. kirjoitusvirhe "aajankohtaista" on todellinen, ei meidän
 * virheemme). Kolme sivua koko historia — ei tarvetta päivämäärä-
 * rajaukselle, source_url-pohjainen duplicate_source-tarkistus
 * import-reitillä riittää estämään uudelleenkäsittelyn.
 */
const BASE_URL = "https://rajukivi.fi/category/aajankohtaista/"

const EXCLUDE_KEYWORDS = [
  "olemme ylpeitä",
  "arvomme",
  "tavoitteemme on luoda",
  "hyvää joulua",
  "joulua",
  "avoimet työpaikat",
  "arvostettu työpaikka",
  "sertifikaatin arvoinen",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "valmis ", "luovutettiin"]

function toSentenceCase(value: string) {
  const lower = value.toLowerCase().trim()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export async function fetchRajukiviSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= 4; page++) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`

    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    const articles = $("article[id^='post-']")
    if (articles.length === 0) break

    articles.each((_, el) => {
      const $el = $(el)
      const titleLink = $el.find("h2.entry-title a").first()
      const rawTitle = titleLink.text().trim()
      const href = titleLink.attr("href")

      if (!rawTitle || !href) return
      if (seenUrls.has(href)) return
      seenUrls.add(href)

      const title = toSentenceCase(rawTitle)

      const postMetaNode = $el.find("p.post-meta").first().get(0)
      const nextNode = postMetaNode?.next
      const description =
        nextNode && nextNode.type === "text"
          ? (nextNode.data ?? "").trim()
          : ""

      const combinedText = `${title} ${description}`.toLowerCase()

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
        source_name: "rajukivi",
      })
    })
  }

  return results
}
