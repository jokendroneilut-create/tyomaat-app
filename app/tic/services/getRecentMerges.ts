import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RecentMerge = {
  id: string
  created_at: string
  source_name: string | null
  candidate_title: string | null
  project_id: string
  project_name: string | null
  confidence: number | null
  matchedVia: string | null
  phaseAdvanced: boolean
  source_url: string | null
}

export async function getRecentMerges(limit = 100): Promise<RecentMerge[]> {
  const { data: imports, error } = await supabaseAdmin
    .from("project_imports")
    .select(
      "id, created_at, source_name, potential_project_id, project_id, changes, metadata"
    )
    .eq("action", "matched_existing_project")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = imports ?? []
  if (rows.length === 0) return []

  const potentialIds = [
    ...new Set(rows.map((r) => r.potential_project_id).filter(Boolean)),
  ]
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))]

  const [{ data: potentials }, { data: projects }] = await Promise.all([
    supabaseAdmin
      .from("potential_projects")
      .select("id, title")
      .in("id", potentialIds.length ? potentialIds : ["00000000-0000-0000-0000-000000000000"]),
    supabaseAdmin
      .from("projects")
      .select("id, name")
      .in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
  ])

  const potentialTitleById = new Map(
    (potentials ?? []).map((p) => [p.id, p.title as string | null])
  )
  const projectNameById = new Map(
    (projects ?? []).map((p) => [p.id, p.name as string | null])
  )

  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    source_name: row.source_name,
    candidate_title: potentialTitleById.get(row.potential_project_id) ?? null,
    project_id: row.project_id,
    project_name: projectNameById.get(row.project_id) ?? null,
    confidence: row.changes?.matched_existing_project?.confidence ?? null,
    matchedVia: row.changes?.matched_existing_project?.matchedVia ?? null,
    phaseAdvanced: Boolean(row.changes?.matched_existing_project?.phaseAdvanced),
    source_url: row.metadata?.source_url ?? null,
  }))
}
