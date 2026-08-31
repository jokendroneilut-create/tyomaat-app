import { createClient } from "@supabase/supabase-js"
import { resolveRegion } from "@/lib/projects/resolveRegion"

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

export type CandidateSourceHistoryEntry = {
  source_name: string | null
  source_document_id: string | null
  document_url: string | null
  notice_type: string | null
  main_type: string | null
  date_published: string | null
  is_contract_award: boolean
  winners: string[] | null
  seen_at: string
}

export type CandidateDetail = {
  candidate: any
  signals: CandidateSignal[]
  sourceHistory: CandidateSourceHistoryEntry[]
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

  const sourceHistory: CandidateSourceHistoryEntry[] = Array.isArray(
    metadata.source_history
  )
    ? metadata.source_history
    : []

  /*
   * Faktat haetaan KAIKILTA hankkeen lähteiltä (source_history), ei vain
   * viimeisimmältä source_document_id:ltä. Näin esim. tarjousilmoituksen ja
   * jälki-ilmoituksen (voittajan) tiedot näkyvät molemmat kumulatiivisesti.
   * Legacy: mukaan otetaan myös metadata.source_document_id niille vanhoille
   * hankkeille joilla source_history-taulukkoa ei vielä ole.
   */
  const documentIds = Array.from(
    new Set(
      [
        ...sourceHistory.map((entry) => entry.source_document_id),
        metadata.source_document_id ?? null,
      ].filter((value): value is string => Boolean(value))
    )
  )

  const sourceDocumentsById = new Map<string, any>()

  if (documentIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("source_documents")
      .select("id, document_url, source_name")
      .in("id", documentIds)

    if (error) throw error

    for (const doc of data ?? []) {
      sourceDocumentsById.set(doc.id, doc)
    }
  }

  const { data: facts, error: factsError } =
    documentIds.length > 0
      ? await supabaseAdmin
          .from("project_facts")
          .select("*")
          .in("document_id", documentIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null }

  if (factsError) throw factsError

  const signals: CandidateSignal[] = [
    {
      id: potentialProject.id,
      created_at: potentialProject.created_at,
      title: metadata.operation ?? potentialProject.title ?? "Ehdokas",
      source_name: metadata.firstSourceName ?? metadata.lastSourceName ?? potentialProject.source_name ?? null,
      source_url:
        sourceDocumentsById.get(metadata.source_document_id)?.document_url ?? null,
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
      source_name:
        fact.source_name ??
        sourceDocumentsById.get(fact.document_id)?.source_name ??
        potentialProject.source_name ??
        null,
      source_url: sourceDocumentsById.get(fact.document_id)?.document_url ?? null,
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
      /*
       * Maakunta paatellaan kunnasta samalla saannolla kuin
       * hyvaksynnassa. Aiemmin esikatselu luki pelkkaa
       * metadata.region-kenttaa ja naytti tyhjaa niille lahteille jotka
       * eivat sita kirjoita (Espoon kuulutukset, Hilma).
       */
      region: resolveRegion({
        metadataRegion: metadata.region,
        city: potentialProject.municipality,
        buyerName: metadata.developer,
      }),
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
    sourceHistory,
  }
}
