import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type CandidateSignal = {
  id: string
  created_at: string
  title: string
  source_name: string | null
  source_url: string | null
  normalized_signal_type: string | null
  relevance_score: number | null
  review_status: string | null
  classification_reason: string | null
}

export type CandidateDetail = {
  candidate: any
  signals: CandidateSignal[]
}

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  const { data: potentialProject, error: potentialError } = await supabaseAdmin
    .from("potential_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (potentialError) throw potentialError

  if (!potentialProject) {
    return null
  }

  const metadata = potentialProject.metadata ?? {}
  const sourceDocumentId = metadata.source_document_id ?? null

  let sourceDocument: any = null

  if (sourceDocumentId) {
    const { data, error } = await supabaseAdmin
      .from("source_documents")
      .select("*")
      .eq("id", sourceDocumentId)
      .maybeSingle()

    if (error) throw error
    sourceDocument = data
  }

  const { data: facts, error: factsError } = sourceDocumentId
    ? await supabaseAdmin
        .from("project_facts")
        .select("*")
        .eq("document_id", sourceDocumentId)
        .eq("metadata->>decision_index", String(metadata.decision_index))
        .order("created_at", { ascending: false })
    : { data: [], error: null }

  if (factsError) throw factsError

  const signals: CandidateSignal[] = [
    {
      id: potentialProject.id,
      created_at: potentialProject.created_at,
      title: metadata.operation ?? potentialProject.title ?? "Ehdokas",
      source_name: metadata.firstSourceName ?? metadata.lastSourceName ?? potentialProject.source_name ?? null,
      source_url: sourceDocument?.document_url ?? null,
      normalized_signal_type: metadata.construction_type ?? "potential_project",
      relevance_score: potentialProject.confidence ?? null,
      review_status: potentialProject.status ?? null,
      classification_reason: Array.isArray(metadata.classification_reasons)
        ? metadata.classification_reasons.join(", ")
        : null,
    },
    ...(facts ?? []).map((fact: any) => ({
      id: fact.id,
      created_at: fact.created_at,
      title: `${fact.fact_type}: ${fact.fact_value ?? fact.fact_number ?? fact.fact_date ?? "-"}`,
      source_name: fact.source_name ?? potentialProject.source_name ?? null,
      source_url: sourceDocument?.document_url ?? null,
      normalized_signal_type: fact.fact_type ?? null,
      relevance_score: fact.confidence ?? null,
      review_status: potentialProject.status ?? null,
      classification_reason: fact.fact_key ?? null,
    })),
  ]

  return {
    candidate: {
      id: potentialProject.id,
      title: potentialProject.title,
      city: potentialProject.municipality,
      location: potentialProject.address,
      reason: metadata.operation ?? null,
      score: potentialProject.confidence ?? 0,
      confidence: metadata.classification_confidence ?? potentialProject.confidence ?? 0,
      signal_count: signals.length,
      source_count: potentialProject.source_count ?? 1,
      last_signal_at: potentialProject.last_seen ?? potentialProject.updated_at ?? potentialProject.created_at,
      metadata,
    },
    signals,
  }
}