import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"

/*
 * Lujatalon "ajankohtaista"-sivu on Gatsby-sovellus (kuten SRV), mutta
 * täällä build-aikainen data-JSON on pieni ja sisältää valmiiksi vain
 * uutislistan (title/uri/date/categories) — ei tarvitse suodattaa
 * sijoittajatiedotteiden joukosta kuten SRV:llä.
 */
const BASE = "https://www.lujatalo.fi"

const EXCLUDE_KEYWORDS = [
  "aluejohtaja",
  "myyntijohtaja",
  "asiakastyytyväisyystutkimuksessa",
  "rekry",
  "avoin työpaikka",
  "vuosikertomus",
  "tilinpäätös",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "valmis"]

/*
 * Listasivun otsikko ei useinkaan sisällä kaupunkia tai valmistumis-
 * ajankohtaa (esim. "hanke valmistuu lokakuussa 2026" on vain artikkelin
 * leipätekstissä) — haetaan artikkelisivu. Sivun lopussa on "Sinua
 * saattaisi kiinnostaa" -palkki, joka listaa MUIDEN artikkeleiden
 * otsikoita — leikataan pois, jottei väärä kaupunki/päivämäärä poimiudu
 * naapuriartikkelista.
 */
async function fetchArticleBodyText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)
    $("script, style").remove()

    const fullText = $("body").text().replace(/\s+/g, " ").trim()
    return fullText.split(/sinua saattaisi kiinnostaa/i)[0]?.trim() || null
  } catch {
    return null
  }
}

export async function fetchLujataloSource() {
  const results: any[] = []
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 1; page <= 3; page++) {
    const url =
      page === 1
        ? `${BASE}/page-data/ajankohtaista/page-data.json`
        : `${BASE}/page-data/ajankohtaista/${page}/page-data.json`

    const res = await fetch(url)
    if (!res.ok) break

    const json = await res.json()
    const nodes = json?.result?.data?.posts?.nodes ?? []
    if (nodes.length === 0) break

    for (const node of nodes) {
      const title = (node.title ?? "").trim()
      const uri = node.uri
      if (!title || !uri) continue

      const dateMatch = (node.date ?? "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (dateMatch) {
        const [, day, month, year] = dateMatch
        const articleDate = new Date(Number(year), Number(month) - 1, Number(day))
        if (articleDate < cutoffDate) continue
      }

      const combinedText = title.toLowerCase()
      if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) continue

      const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))
      const sourceUrl = `${BASE}${uri}`

      const bodyText = await fetchArticleBodyText(sourceUrl)
      const city = detectCityFromText(title) ?? (bodyText ? detectCityFromText(bodyText) : null)
      const estimatedCompletion = bodyText ? parseEstimatedCompletionDate(bodyText) : null

      results.push({
        name: title,
        city,
        region: null,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: sourceUrl,
        confidence: 0.6,
        completed,
        source_name: "lujatalo",
        estimated_completion: estimatedCompletion,
      })
    }
  }

  return results
}
