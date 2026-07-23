import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RecentEnrichment = {
  id: string
  created_at: string
  project_id: string
  project_name: string | null
  project_city: string | null
  source_name: string | null
  previous_phase: string | null
  phase: string | null
  reason: string | null
}

/*
 * "Rikastus" = jo hyväksytty hanke päivittyy taustalla uudesta
 * signaalista (esim. syncApprovedProject.ts, jota mm. rajukiviResolver
 * käyttää) ilman että se koskaan käy TIC-hyväksyntäjonon läpi. Eri
 * mekanismi kuin getRecentMerges.ts:n "Yhdistyneet hankkeet"
 * (project_imports, action=matched_existing_project), joka koskee vain
 * hyväksymishetkellä havaittuja täsmäytyksiä.
 */
export async function getRecentEnrichments(limit = 100): Promise<RecentEnrichment[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("project_phase_history")
    .select("id, created_at, project_id, source_name, previous_phase, phase, reason")
    .eq("source", "auto_sync")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!rows || rows.length === 0) return []

  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))]

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from("projects")
    .select("id, name, city")
    .in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])

  if (projectsError) throw projectsError

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]))

  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    project_id: row.project_id,
    project_name: projectById.get(row.project_id)?.name ?? null,
    project_city: projectById.get(row.project_id)?.city ?? null,
    source_name: row.source_name,
    previous_phase: row.previous_phase,
    phase: row.phase,
    reason: row.reason,
  }))
}
