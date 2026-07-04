import { extractNextData } from "../extractors/nextDataExtractor"
import { findObjectsByType } from "../extractors/jsonExplorer"
import type { NormalizedDocument } from "../types"

type EspooArticle = {
  type?: string
  title?: string
  meta?: {
    path?: string
    greaterAreas?: { name?: string }[]
    topic?: { name?: string }[]
  }
}

export function parseEspooNotices(rawHtml: string): NormalizedDocument[] {
  const nextData = extractNextData(rawHtml)

  if (!nextData) {
    return []
  }

  const articles = findObjectsByType(nextData, "Article") as EspooArticle[]

  return articles
    .filter((article) => article.title && article.meta?.path)
    .map((article) => {
      const topic = article.meta?.topic?.[0]?.name
      const area = article.meta?.greaterAreas?.[0]?.name

      return {
        title: article.title!,
        url: `https://www.espoo.fi${article.meta!.path}`,
        sourceType: "html",
        category: topic,
        area,
        raw: article,
      }
    })
}