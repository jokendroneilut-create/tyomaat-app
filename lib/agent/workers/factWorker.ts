import { createClient } from "@supabase/supabase-js"
import { extractFacts } from "@/lib/agent/facts/extractFacts"
import { splitEspooPermitNoticeText } from "@/lib/agent/building-permits/decisionSplitter"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runFactWorker() {
  const startedAt = Date.now()

  const { data: document, error: documentError } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .not("extracted_text", "is", null)
    .is("facts_extracted_at", null)
    .order("text_extracted_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (documentError) throw documentError

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

    const fullText = document.extracted_text ?? ""
    const decisions = splitEspooPermitNoticeText(fullText)

    console.log("Decision count:", decisions.length)

    let allFacts: ReturnType<typeof extractFacts> = []

    for (const decision of decisions) {
      console.log(
        "Decision:",
        decision.index,
        decision.sectionNumber,
        decision.address,
        decision.permitNumber
      )

      const decisionFacts = extractFacts({
        documentId: document.id,
        sourceName: document.source_name,
        text: decision.rawText,
      })

      const factsWithDecisionMetadata = decisionFacts.map((fact) => ({
        ...fact,
        metadata: {
          ...(fact.metadata ?? {}),
          decision_index: decision.index,
          section_number: decision.sectionNumber,
          permit_number: decision.permitNumber,
          address: decision.address,
          property_ids: decision.propertyIds,
          district: decision.district,
          operation: decision.operation,
          decision_maker: decision.decisionMaker,
        },
      }))

      allFacts = [...allFacts, ...factsWithDecisionMetadata]
    }

    const facts =
      decisions.length > 0
        ? allFacts
        : extractFacts({
            documentId: document.id,
            sourceName: document.source_name,
            text: fullText,
          })

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