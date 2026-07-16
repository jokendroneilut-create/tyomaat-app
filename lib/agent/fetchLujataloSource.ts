import { detectCityFromText } from "./detectCityFromText"

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

      results.push({
        name: title,
        city: detectCityFromText(title),
        region: null,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: `${BASE}${uri}`,
        confidence: 0.6,
        completed,
        source_name: "lujatalo",
      })
    }
  }

  return results
}
