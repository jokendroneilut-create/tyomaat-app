import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DuplicateProjectInfo = {
  id: string
  name: string | null
  city: string | null
  phase: string | null
  is_public: boolean
}

export type DuplicateCandidate = {
  id: string
  created_at: string
  confidence: number
  reasons: string[]
  projectA: DuplicateProjectInfo | null
  projectB: DuplicateProjectInfo | null
}

export async function getDuplicateCandidates(
  limit = 100
): Promise<DuplicateCandidate[]> {
  const { data: pairs, error } = await supabaseAdmin
    .from("project_duplicate_candidates")
    .select("id, created_at, project_id_a, project_id_b, confidence, reasons")
    .eq("status", "pending")
    .order("confidence", { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = pairs ?? []
  if (rows.length === 0) return []

  const projectIds = [
    ...new Set(rows.flatMap((r) => [r.project_id_a, r.project_id_b])),
  ]

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from("projects")
    .select("id, name, city, phase, is_public")
    .in("id", projectIds)

  if (projectsError) throw projectsError

  const projectById = new Map(
    (projects ?? []).map((p) => [p.id, p as DuplicateProjectInfo])
  )

  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    confidence: row.confidence,
    reasons: row.reasons ?? [],
    projectA: projectById.get(row.project_id_a) ?? null,
    projectB: projectById.get(row.project_id_b) ?? null,
  }))
}

export async function getPendingDuplicateCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("project_duplicate_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")

  if (error) throw error
  return count ?? 0
}
