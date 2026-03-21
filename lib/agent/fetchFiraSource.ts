import { detectCityFromText } from "./detectCityFromText"

export async function fetchFiraSource() {
  const results: any[] = []

for (let page = 1; page <= 5; page++) {
  const res = await fetch(
    `https://fira.fi/wp-json/wp/v2/posts?per_page=50&page=${page}`
  )

  if (!res.ok) break

  const posts = await res.json()

  if (!posts.length) break

  for (const post of posts) {
    const title = (post?.title?.rendered || "")
      .replace(/&#8211;/g, "–")
      .replace(/&#038;/g, "&")
      .replace(/&amp;/g, "&")
      .trim()

const postDate = post?.date ? new Date(post.date) : null
const cutoffDate = new Date()
cutoffDate.setMonth(cutoffDate.getMonth() - 24)

if (postDate && postDate < cutoffDate) {
  
  continue
}
    const href = post?.link

    if (!title || !href) continue

    const projectKeywords = [
      "rakentaa",
      "rakentaminen",
      "rakentuu",
      "toimitila",
      "toimitilarakentaminen",
      "hanke",
      "kohde",
      "asunto",
      "asunnot",
      "koti",
      "kodit",
      "kortteli",
      "logistiikka",
      "datakeskus",
      "teollisuus",
      "korjausrakentaminen",
      "modernisointi",
      "pysäköintilaitos",
    ]

    const lower = title.toLowerCase()

    if (!projectKeywords.some((k) => lower.includes(k))) {
      continue
    }

    const completedKeywords = [
      "valmistui",
      "valmistunut",
      "luovutettu",
      "luovutti",
      "otettu käyttöön",
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
      source_url: href,
      confidence: 0.6,
      completed,
      source_name: "fira",
    })
  }
}

  return results
}