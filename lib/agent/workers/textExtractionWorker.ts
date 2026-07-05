import { createClient } from "@supabase/supabase-js"
import pdfParse from "pdf-parse/lib/pdf-parse.js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runTextExtractionWorker() {
  const startedAt = Date.now()

  const { data: document, error: documentError } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .eq("document_type", "pdf")
    .is("extracted_text", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (documentError) throw documentError

  if (!document) {
    return {
      ok: true,
      message: "No PDF documents waiting for text extraction",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent_type: "text_extraction_worker",
      source_id: document.source_id,
      source_name: document.source_name,
      status: "started",
      started_at: new Date().toISOString(),
      payload: {
        documentId: document.id,
        documentUrl: document.document_url,
      },
    })
    .select()
    .single()

  if (runError) throw runError

  try {
    const response = await fetch(document.document_url, {
      headers: {
        accept: "application/pdf,*/*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(
        `PDF fetch failed: ${response.status} ${response.statusText}`
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const parsed = await pdfParse(buffer)
    const text = parsed.text?.trim() ?? ""
    const pages = parsed.numpages ?? null

    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("source_documents")
      .update({
        extracted_text: text,
        text_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        raw_payload: {
          ...(document.raw_payload ?? {}),
          textExtraction: {
            extractedAt: new Date().toISOString(),
            pages,
            textLength: text.length,
          },
        },
      })
      .eq("id", document.id)

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        text_documents: 1,
        payload: {
          documentId: document.id,
          documentUrl: document.document_url,
          pages,
          textLength: text.length,
        },
      })
      .eq("id", run.id)

    return {
      ok: true,
      runId: run.id,
      documentId: document.id,
      pages,
      textLength: text.length,
      durationMs,
    }
  } catch (error: any) {
    console.error("TEXT EXTRACTION WORKER ERROR", error)
    console.error(error?.stack)

    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_message: error.message,
      })
      .eq("id", run.id)

    return {
      ok: false,
      runId: run.id,
      documentId: document.id,
      error: error.message,
      durationMs,
    }
  }
}