import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function daysAgoIso(days: number) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export async function getTodaySummary() {
  const sevenDaysAgo = daysAgoIso(7)

  const { data: approvedProjects, error: approvedError } = await supabaseAdmin
    .from("projects")
    .select(`
      id,
      created_at,
      name,
      city,
      region,
      location,
      property_type,
      phase,
      additional_info,
      metadata
    `)
    .eq("status", "active")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(20)

  if (approvedError) throw approvedError

  const { data: newPotentialProjects, error: potentialError } =
    await supabaseAdmin
      .from("potential_projects")
      .select(`
        id,
        created_at,
        title,
        municipality,
        address,
        confidence,
        status,
        metadata
      `)
      .eq("status", "new")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50)

  if (potentialError) throw potentialError

  const highValueProjects = (approvedProjects ?? []).filter(
    (project: any) => project.metadata?.business_value === "high"
  )

  return {
  metrics: {
    newProjects: approvedProjects?.length ?? 0,
    approvedToday: approvedProjects?.length ?? 0,
    highValue: highValueProjects.length,
    tenders: 0,
  },
    approvedProjects: approvedProjects ?? [],
    newPotentialProjects: newPotentialProjects ?? [],
    recommendedProjects: highValueProjects.slice(0, 10),
  }
}