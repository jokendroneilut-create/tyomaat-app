import { RssCollector } from "../collectors/rssCollector"
import { parseGenericRss } from "../parsers/genericRssParser"
import { saveSignal } from "../signals/saveSignal"

type AgentSource = {
  id: string
  name: string
  source_url: string
  source_type: string
  parser_name: string | null
  city: string | null
}

type SaveSignalResult = {
  skipped?: boolean
  reason?: string
  [key: string]: any
}

export async function runSource(source: AgentSource) {
  if (source.source_type !== "rss") {
    throw new Error(`Unsupported source_type: ${source.source_type}`)
  }

  const collector = new RssCollector({
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.source_url,
  })

  const result = await collector.collect()

  const signals = result.documents.flatMap((document) => {
    if (source.parser_name === "generic_rss") {
      return parseGenericRss(document).map((signal) => ({
        ...signal,
        city: source.city ?? signal.city,
      }))
    }

    throw new Error(`Unsupported parser_name: ${source.parser_name}`)
  })

  const results: SaveSignalResult[] = []

  for (const signal of signals) {
    results.push(await saveSignal(signal))
  }

  const savedCount = results.filter((result) => !result.skipped).length
  const skippedCount = results.filter((result) => result.skipped).length

  return {
    sourceId: source.id,
    sourceName: source.name,
    documents: result.documents.length,
    signals: signals.length,
    saved: savedCount,
    skipped: skippedCount,
  }
}