import * as cheerio from "cheerio"

/*
 * Jaettu RSS/Atom-lukija useammalle yrityslähteelle (WordPress-sivustot
 * tarjoavat lähes aina /feed/-osoitteen valmiiksi). cheerion xmlMode
 * purkaa CDATA-lohkot automaattisesti .text()-kutsussa.
 */
export type RssItem = {
  title: string
  link: string
  pubDate: Date | null
  description: string
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url)
  if (!res.ok) return []

  const xml = await res.text()
  const $ = cheerio.load(xml, { xmlMode: true })

  const items: RssItem[] = []

  $("item").each((_, el) => {
    const $el = $(el)
    const title = $el.find("title").first().text().trim()
    const link = $el.find("link").first().text().trim()
    const pubDateRaw = $el.find("pubDate").first().text().trim()
    const descriptionRaw = $el.find("description").first().text()

    if (!title || !link) return

    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null

    items.push({
      title,
      link,
      pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null,
      description: descriptionRaw
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    })
  })

  return items
}
