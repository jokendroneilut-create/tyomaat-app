import type { Collector } from "../pipeline/interfaces"
import type { FetchResult, RawDocument } from "../pipeline/types"

type RssCollectorOptions = {
  sourceId: string
  sourceName: string
  sourceUrl: string
}

export class RssCollector implements Collector {
  constructor(private options: RssCollectorOptions) {}

  async collect(): Promise<FetchResult> {
    const res = await fetch(this.options.sourceUrl)

    if (!res.ok) {
      throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`)
    }

    const text = await res.text()
    const fetchedAt = new Date()

    const document: RawDocument = {
      sourceId: this.options.sourceId,
      sourceName: this.options.sourceName,
      sourceUrl: this.options.sourceUrl,
      fetchedAt,
      contentType: res.headers.get("content-type") || "application/rss+xml",
      raw: text,
    }

    return {
      sourceId: this.options.sourceId,
      fetchedAt,
      documents: [document],
    }
  }
}