import type { RawDocument, Signal } from "../pipeline/types"

function getTagValue(item: string, tag: string): string | undefined {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match?.[1]
    ?.replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim()
}

export function parseGenericRss(document: RawDocument): Signal[] {
  if (typeof document.raw !== "string") return []

  const items = document.raw.match(/<item[\s\S]*?<\/item>/gi) || []

  return items.map((item) => {
    const title = getTagValue(item, "title") || "Untitled RSS item"
    const description = getTagValue(item, "description")
    const link = getTagValue(item, "link") || document.sourceUrl
    const pubDate = getTagValue(item, "pubDate")

    return {
      externalId: link,
      type: "uutinen",
      title,
      description,
      city: undefined,
      location: undefined,
      sourceUrl: link,
      detectedAt: pubDate ? new Date(pubDate) : document.fetchedAt,
      raw: {
        sourceName: document.sourceName,
        item,
      },
    }
  })
}