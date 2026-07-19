import { createClient } from "@supabase/supabase-js"
import { resolveFacts } from "@/lib/agent/facts/resolveFacts"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runFactWorker(documentId?: string) {
  const startedAt = Date.now()

  let document: any = null

  if (documentId) {
    const { data, error } = await supabaseAdmin
      .from("source_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle()

    if (error) throw error
    document = data
  } else {
    const { data: documents, error: documentError } = await supabaseAdmin
      .from("source_documents")
      .select("*")
      .is("facts_extracted_at", null)
      .order("created_at", { ascending: false })
      .limit(100)

    if (documentError) throw documentError

    const JSON_ONLY_SOURCES = [
      "Hilma",
      "Lupapiste kuulutukset",
      "Vantaan vireillä olevat kaavat",
      "Helsingin vireillä olevat kaavat",
      "Tampereen vireillä olevat kaavat",
      "Turun vireillä olevat kaavat",
      "Kreate hankkeet",
      "Väylävirasto hankkeet",
      "Senaatti-kiinteistöt hankkeet",
      "Puolustuskiinteistöt uutiset",
      "Espoon ajankohtaiset asemakaavat",
      "Lohjan ajankohtaiset kaavat",
      "Rauman vireillä olevat asemakaavat",
      "Kaarinan vireillä olevat asemakaavat",
      "Nokian vireillä olevat asemakaavat",
      "Kajaanin vireillä olevat asemakaavat",
      "Savonlinnan asemakaavakuulutukset",
      "Kangasalan vireillä olevat asemakaavat",
      "Ylöjärven vireillä olevat asemakaavat",
      "Vihdin vireillä olevat asemakaavat",
      "Riihimäen vireillä olevat asemakaavat",
      "Raaseporin vireillä olevat asemakaavat",
      "Raision vireillä olevat asemakaavat",
      "Lempäälän vireillä olevat asemakaavat",
      "Imatran vireillä olevat asemakaavat",
      "Raahen vireillä olevat asemakaavat",
      "Sastamalan vireillä ja nähtävillä olevat kaavat",
      "Hollolan aktiiviset kaavat",
      "Kuopion vireillä olevat kaavat",
      "Hyvinkään vireillä olevat kaavat",
      "Seinäjoen ajankohtaiset asemakaavat",
      "Rovaniemen Kaavatori",
      "Mikkelin vireillä olevat kaavat",
      "Kotkan vireillä olevat asemakaavat",
      "Salon ajankohtaiset asemakaavat",
      "Porvoon asemakaavat",
      "Kokkolan asemakaavatyöt",
      "Kirkkonummen kaavoitus",
      "Keravan kaavahankkeet",
      "Tuusulan vireillä olevat kaavat",
      "Nurmijärven ajankohtaiset asemakaavat",
      "Sipoon vireillä olevat asemakaavat",
      "Järvenpään vireillä olevat asemakaavat",
      "Lahden kaavatyökohteet",
      "Porin vireillä olevat kaavat",
      "Oulun vireillä olevat kaavat",
      "Jyväskylän vireillä olevat kaavat",
      "Hämeenlinnan vireillä olevat kaavat",
      "Joensuun laadinnassa olevat kaavat",
      "Vaasan vireillä olevat asemakaavat",
      "Kouvolan ajankohtaiset asemakaavat",
      "Lappeenrannan vireillä olevat asemakaavat",
    ]

    document =
      (documents ?? []).find((d) =>
        JSON_ONLY_SOURCES.includes(d.source_name)
          ? !!(d.raw_payload?.original || d.raw_text)
          : !!d.extracted_text
      ) ?? null
  }

  if (!document) {
    return {
      ok: true,
      message: "No documents waiting for fact extraction",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent_type: "fact_worker",
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
    await supabaseAdmin
      .from("project_facts")
      .delete()
      .eq("document_id", document.id)

    const { decisions, facts } = resolveFacts(document)

    console.log("Decision count:", decisions.length)

    let savedCount = 0

    for (const fact of facts) {
      const { error } = await supabaseAdmin.from("project_facts").insert({
        document_id: document.id,
        fact_type: fact.fact_type,
        fact_key: fact.fact_key ?? null,
        fact_value: fact.fact_value ?? null,
        fact_number: fact.fact_number ?? null,
        fact_date: fact.fact_date ?? null,
        confidence: fact.confidence,
        source_name: document.source_name,
        metadata: fact.metadata ?? {},
      })

      if (error) throw error
      savedCount += 1
    }

    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("source_documents")
      .update({
        facts_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id)

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        entities_found: savedCount,
        payload: {
          documentId: document.id,
          decisionsFound: decisions.length,
          factsFound: facts.length,
          factsSaved: savedCount,
        },
      })
      .eq("id", run.id)

    return {
      ok: true,
      runId: run.id,
      documentId: document.id,
      decisionsFound: decisions.length,
      factsFound: facts.length,
      factsSaved: savedCount,
      durationMs,
    }
  } catch (error: any) {
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