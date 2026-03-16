import * as cheerio from "cheerio"

function detectCityFromText(text: string): string | null {
  const cities = [
    "helsinki",
    "espoo",
    "vantaa",
    "tampere",
    "turku",
    "oulu",
    "jyväskylä",
    "lahti",
    "kuopio",
    "raisio",
    "kempele",
    "ylöjärvi",
    "hämeenlinna",
    "pori",
    "joensuu",
    "lappeenranta",
    "kerava",
    "tuusula",
    "järvenpää",
  ]

  const lower = text.toLowerCase()

  const cityAliases: Record<string, string> = {
    "kempeleessä": "Kempele",
    "ylöjärvellä": "Ylöjärvi",
    "hämeenlinnan": "Hämeenlinna",
    "tampereen": "Tampere",
  }

  for (const [alias, city] of Object.entries(cityAliases)) {
    if (lower.includes(alias)) return city
  }

  for (const city of cities) {
    const regex = new RegExp(
      `\\b${city}(ssa|ssä|sta|stä|seen|lla|llä|lta|ltä|lle|na|nä|n|in)?\\b`,
      "i"
    )
    if (regex.test(lower)) {
      return city.charAt(0).toUpperCase() + city.slice(1)
    }
  }

  return null
}

export async function fetchYitSource() {
  const res = await fetch("https://www.yitgroup.com/fi/media?categories=250A64D624AE4B9EA64BE14A53473EA9%2C4E7ACD1B892840F9906B87E64775B521%2C1FE3FC08D0DA4C32B14F0420DB875149")
  const html = await res.text()
 

  const $ = cheerio.load(html)

  const results: any[] = []

 $('a.mediaroom__grid__text').each((_, el) => {
  const title = $(el).find("h3").text().trim()
  const href = $(el).attr("href")
const projectKeywords = [
  "rakentaa",
  "rakentaminen",
  "rakennus",
  "hanke",
  "koulu",
  "päiväkoti",
  "asunto",
  "kodit",
  "kerrostalo",
  "kortteli",
  "alueelle",
  "sairaala",
  "palvelukeskus",
  "toimitila",
]

const lowerTitle = title.toLowerCase()

if (!projectKeywords.some((k) => lowerTitle.includes(k))) {
  return
}
  if (!title || !href) return

  const city = detectCityFromText(title)

results.push({
  name: title,
  city,
    region: null,
    location: null,
    phase: "Suunnittelussa",
    source_url: href.startsWith("http")
      ? href
      : `https://www.yitgroup.com${href}`,
    confidence: 0.6,
    completed: false,
    source_name: "yit",
  })
})

  return results
}