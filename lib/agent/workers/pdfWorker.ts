import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashContent(value: Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export async function runPdfWorker() {
  const startedAt = Date.now()

  const { data: job, error: jobError } = await supabaseAdmin
    .from("agent_jobs")
    .select("*")
    .eq("status", "pending")
    .eq("job_type", "collect_pdf")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (jobError) throw jobError

  if (!job) {
    return {
      ok: true,
      message: "No pending PDF jobs",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent_type: "pdf_worker",
      source_id: job.payload?.sourceId ?? null,
      source_name: job.payload?.sourceName ?? null,
      status: "started",
      started_at: new Date().toISOString(),
      payload: {
        jobId: job.id,
        pdfUrl: job.payload?.pdfUrl,
      },
    })
    .select()
    .single()

  if (runError) throw runError

  await supabaseAdmin
    .from("agent_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: Number(job.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)

  try {
    const pdfUrl = job.payload?.pdfUrl

    if (!pdfUrl) {
      throw new Error("Missing pdfUrl in job payload")
    }

    const response = await fetch(pdfUrl, {
      headers: {
        accept: "application/pdf,*/*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`PDF fetch failed: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentHash = hashContent(buffer)

    const { data: document, error: documentError } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: job.payload.sourceId,
          source_name: job.payload.sourceName,
          title: decodeURIComponent(pdfUrl.split("/").pop() ?? "PDF document"),
          document_url: pdfUrl,
          document_type: "pdf",
          content_hash: contentHash,
          status: "downloaded",
          raw_payload: {
            parentDocumentId: job.payload.parentDocumentId,
            pdfUrl,
            sizeBytes: buffer.length,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )
      .select()
      .single()

    if (documentError) throw documentError

    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("agent_jobs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        pdf_found: 1,
        pdf_saved: 1,
        payload: {
          jobId: job.id,
          pdfUrl,
          documentId: document.id,
          sizeBytes: buffer.length,
        },
      })
      .eq("id", run.id)

    return {
      ok: true,
      jobId: job.id,
      runId: run.id,
      documentId: document.id,
      pdfUrl,
      sizeBytes: buffer.length,
      durationMs,
    }
  } catch (error: any) {
    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("agent_jobs")
      .update({
        status: "error",
        error_message: error.message,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)

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
      jobId: job.id,
      runId: run.id,
      error: error.message,
      durationMs,
    }
  }
}