export type RawDocument = {
  sourceId: string
  sourceName: string
  sourceUrl: string
  fetchedAt: Date
  contentType: string
  raw: unknown
}

export type FetchResult = {
  sourceId: string
  fetchedAt: Date
  documents: RawDocument[]
}

export type Signal = {
  externalId?: string

  type: string
  title: string
  description?: string
  city?: string
  location?: string
  sourceUrl: string
  detectedAt: Date
  raw: unknown
}