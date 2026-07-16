import { detectCityFromText } from "./detectCityFromText"

/*
 * KAS asuntojen WordPress REST-rajapinta on avoinna suoraan (ei tarvitse
 * HTML-jäsennystä). "Uutiset"-kategoria (id 1) sekoittaa asukasviestintää
 * (asuntohaut, vakuutusvinkit, juhlatoivotukset) uudisrakentamis- ja
 * peruskorjausuutisiin, joten avainsanasuodatus on tarpeen.
 */
const API_URL = "https://kas.fi/wp-json/wp/v2/posts?categories=1&per_page=50"

const PROJECT_KEYWORDS = [
  "rakennuttaa",
  "valmistuu",
  "valmistui",
  "valmistunut",
  "perusparannus",
  "peruskorjaus",
  "kerrostalo",
  "rivitalo",
  "vuokratalon",
  "uudisrakennus",
]

const EXCLUDE_KEYWORDS = [
  "vuosikertomus",
  "strategia",
  "asuntohaku on nyt auki",
  "vappua",
  "joulua",
  "vakuutus",
  "puheenjohtaja",
  "korotus",
  "heijastinliivejä",
  "energiansäästöviikon",
  "asukas-sivut",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut"]

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchKasSource() {
  const results: any[] = []
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  const res = await fetch(API_URL)
  if (!res.ok) return results

  const posts = await res.json()

  for (const post of posts ?? []) {
    const title = stripHtml(post.title?.rendered ?? "")
    const link = post.link
    if (!title || !link) continue

    const postDate = post.date ? new Date(post.date) : null
    if (postDate && postDate < cutoffDate) continue

    const excerpt = stripHtml(post.excerpt?.rendered ?? "")
    const combinedText = `${title} ${excerpt}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => combinedText.includes(k))) continue
    if (EXCLUDE_KEYWORDS.some((k) => combinedText.includes(k))) continue

    const completed = COMPLETED_KEYWORDS.some((k) => combinedText.includes(k))

    results.push({
      name: title,
      city: detectCityFromText(title) ?? detectCityFromText(combinedText),
      region: null,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: link,
      confidence: 0.6,
      completed,
      source_name: "kas_asunnot",
    })
  }

  return results
}
