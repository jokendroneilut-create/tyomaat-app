import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"
import { parseEspooNotices } from "../parsers/espooNoticesParser"
import type { NormalizedDocument } from "../types"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Source = {
  id: string
  name: string
  url: string
  category: string | null
  priority: number | null
  parser: string | null
}

function hashContent(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function parseSourceDocuments(
  source: Source,
  rawHtml: string
): NormalizedDocument[] {
  if (source.parser === "espooNoticesParser") {
    return parseEspooNotices(rawHtml)
  }

  return [
    {
      title: source.name,
      url: source.url,
      sourceType: "html",
      category: source.category ?? undefined,
      raw: {
        parser: source.parser,
      },
    },
  ]
}

export async function collectHtmlSource(source: Source) {
  const response = await fetch(source.url, {
    headers: {
      accept: "*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`HTML fetch failed: ${response.status} ${response.statusText}`)
  }

  const rawHtml = await response.text()
  const normalizedDocuments = parseSourceDocuments(source, rawHtml)

  let savedCount = 0

  for (const document of normalizedDocuments) {
    const contentForHash = JSON.stringify({
      title: document.title,
      url: document.url,
      raw: document.raw,
    })

    const contentHash = hashContent(contentForHash)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: document.title,
          document_url: document.url,
          document_type: document.sourceType,
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawHtml,
          raw_payload: {
            category: document.category,
            area: document.area,
            priority: source.priority,
            parser: source.parser,
            raw: document.raw,
          },
          published_at: document.publishedAt ?? null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    savedCount += 1
  }

  return {
    documentsFound: normalizedDocuments.length,
    documentsSaved: savedCount,
  }
}