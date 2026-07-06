import { createClient } from "@supabase/supabase-js"
import { collectApiSource } from "@/lib/agent/discovery/collectors/apiCollector"
import { collectHtmlSource } from "@/lib/agent/discovery/collectors/htmlCollector"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runSourceWorker(sourceId: string) {
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("discovery_sources")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (sourceError || !source) {
    return {
      ok: false,
      error: "Source not found",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("discovery_runs")
    .insert({
      source_id: source.id,
      source_name: source.name,
      status: "started",
    })
    .select()
    .single()

  if (runError) throw runError

  try {
    let result

    const collectors: Record<string, (source: any) => Promise<any>> = {
  htmlCollector: collectHtmlSource,
  apiCollector: collectApiSource,
}

const collectorName = source.collector ?? (
  source.type === "api" ? "apiCollector" :
  source.type === "html" ? "htmlCollector" :
  null
)

if (!collectorName || !collectors[collectorName]) {
  throw new Error(`Unsupported collector: ${collectorName ?? source.type}`)
}

result = await collectors[collectorName](source)

    await supabaseAdmin
      .from("discovery_runs")
      .update({
        status: "success",
        documents_found: result.documentsFound ?? 1,
        documents_saved: result.documentsSaved ?? 1,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    await supabaseAdmin
      .from("discovery_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        run_count: Number(source.run_count ?? 0) + 1,
        success_count: Number(source.success_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id)

    return {
      ok: true,
      sourceId: source.id,
      source: source.name,
      result,
    }
  } catch (error: any) {
    await supabaseAdmin
      .from("discovery_runs")
      .update({
        status: "error",
        error_message: error.message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    await supabaseAdmin
      .from("discovery_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_error_at: new Date().toISOString(),
        last_error_message: error.message,
        run_count: Number(source.run_count ?? 0) + 1,
        error_count: Number(source.error_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id)

    return {
      ok: false,
      sourceId: source.id,
      source: source.name,
      error: error.message,
    }
  }
}