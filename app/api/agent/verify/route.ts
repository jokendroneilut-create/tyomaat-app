import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: projects } = await supabase
  .from("projects")
  .select("id,name,city,last_verified_at,status,project_sources(source_name,source_url,last_seen_at)")
  .eq("status", "active")
  .order("last_verified_at", { ascending: true, nullsFirst: true })
  .limit(500)

  const verifiableProjects = (projects || []).filter(
  (project: any) => project.project_sources && project.project_sources.length > 0
)

const enrichedProjects = verifiableProjects.map((project: any) => ({
  ...project,
  source_count: project.project_sources?.length || 0,
}))

const verifiedAt = new Date().toISOString()
for (const project of enrichedProjects) {
  await supabase
    .from("projects")
    .update({
      last_verified_at: verifiedAt,
    })
    .eq("id", project.id)
}
const verifiedProjects = enrichedProjects.map((project: any) => ({
  ...project,
  last_verified_at: verifiedAt,
}))
    return NextResponse.json({
  ok: true,
  count: verifiedProjects.length,
  projects: verifiedProjects,
})
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}