import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"
import { extractLinks } from "../extractors/linkExtractor"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashContent(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function toAbsoluteUrl(link: string, baseUrl: string) {
  if (link.startsWith("http")) return link
  if (link.startsWith("/")) return new URL(link, baseUrl).toString()
  return new URL(`/${link}`, baseUrl).toString()
}

export async function collectArticleDocument(documentId: string) {
  const { data: document, error } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single()

  if (error) throw error
  if (!document) throw new Error("Document not found")

  const response = await fetch(document.document_url, {
    headers: {
      accept: "*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Article fetch failed: ${response.status} ${response.statusText}`)
  }

  const rawHtml = await response.text()
  const links = extractLinks(rawHtml).map((link) =>
    toAbsoluteUrl(link, document.document_url)
  )

  const pdfLinks = links.filter((link) =>
    link.toLowerCase().includes(".pdf")
  )
for (const pdfLink of pdfLinks) {
  await supabaseAdmin.from("agent_jobs").insert({
    job_type: "collect_pdf",
    status: "pending",
    payload: {
      parentDocumentId: document.id,
      sourceId: document.source_id,
      sourceName: document.source_name,
      pdfUrl: pdfLink,
    },
  })
}
  const contentHash = hashContent(rawHtml)

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("source_documents")
    .update({
      raw_text: rawHtml,
      content_hash: contentHash,
      raw_payload: {
        ...(document.raw_payload ?? {}),
        articleFetchedAt: new Date().toISOString(),
        links,
        pdfLinks,
      },
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select()
    .single()

  if (updateError) throw updateError

  return {
    documentId: updated.id,
    linksFound: links.length,
    pdfLinksFound: pdfLinks.length,
    pdfLinks,
  }
}