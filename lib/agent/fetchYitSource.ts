import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { htmlToText } from "./htmlToText"

const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakentaminen",
  "rakennus",
  "rakentuu",
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

const COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "otettu käyttöön",
  "avautui",
]

/*
 * YIT ei ole STT-uutishuoneessa vaan omalla sivustollaan. Listaussivu antaa
 * vain otsikon ja linkin; koko teksti on artikkelisivun .richtext-lohkossa.
 */
async function fetchYitArticleBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    if (!res.ok) return null

    const $ = cheerio.load(await res.text())
    const bodyHtml = $(".richtext").first().html()
    if (!bodyHtml) return null

    return htmlToText(bodyHtml) || null
  } catch {
    return null
  }
}

export async function fetchYitSource() {
  const res = await fetch(
    "https://www.yitgroup.com/fi/media?categories=250A64D624AE4B9EA64BE14A53473EA9%2C4E7ACD1B892840F9906B87E64775B521%2C1FE3FC08D0DA4C32B14F0420DB875149"
  )
  const html = await res.text()
  const $ = cheerio.load(html)

  // Kerätään otsikot ja linkit ensin, jotta artikkelirungot voidaan hakea
  // asynkronisesti (each-callbackin sisällä ei voi awaitata).
  const items: { title: string; url: string }[] = []

  $("a.mediaroom__grid__text").each((_, el) => {
    const title = $(el).find("h3").text().trim()
    const href = $(el).attr("href")

    if (!title || !href) return

    const lowerTitle = title.toLowerCase()
    if (!PROJECT_KEYWORDS.some((k) => lowerTitle.includes(k))) return

    items.push({
      title,
      url: href.startsWith("http")
        ? href
        : `https://www.yitgroup.com${href}`,
    })
  })

  const results: any[] = []

  for (const { title, url } of items) {
    const lowerTitle = title.toLowerCase()
    const completed = COMPLETED_KEYWORDS.some((k) => lowerTitle.includes(k))

    const description = await fetchYitArticleBody(url)

    // Kaupunki otsikosta, varalla koko artikkelin teksti; maakunta kunnasta.
    const city =
      detectCityFromText(title) ??
      detectCityFromText(`${title} ${description ?? ""}`)
    const region = getMunicipalityByName(city)?.region ?? null

    results.push({
      name: title,
      description,
      city,
      region,
      location: null,
      phase: "Suunnittelussa",
      source_url: url,
      confidence: 0.6,
      completed,
      source_name: "yit",
    })
  }

  return results
}
