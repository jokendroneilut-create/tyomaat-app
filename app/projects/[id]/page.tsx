import { createClient } from "@supabase/supabase-js"
import { displayPhaseLabel } from "@/lib/projects/phases"
import PhaseTimeline from "../PhaseTimeline"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (!project) {
    return <div style={{ padding: 20 }}>Kohdetta ei löytynyt</div>
  }

  const { data: history } = await supabase
    .from("project_phase_history")
    .select("phase, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true })

  return (
    <div style={{ padding: 20 }}>
      <h1>{project.name}</h1>

      <p><strong>Kaupunki:</strong> {project.city || "-"}</p>
      <p><strong>Maakunta:</strong> {project.region || "-"}</p>
      <p><strong>Vaihe:</strong> {displayPhaseLabel(project.phase)}</p>

      <PhaseTimeline rawPhase={project.phase} history={history ?? []} />

      {project.location && (
        <p><strong>Sijainti:</strong> {project.location}</p>
      )}

      {project.property_type && (
        <p><strong>Kohdetyyppi:</strong> {project.property_type}</p>
      )}

      {project.developer && (
        <p><strong>Rakennuttaja:</strong> {project.developer}</p>
      )}

      {project.builder && (
        <p><strong>Rakennusliike:</strong> {project.builder}</p>
      )}
    </div>
  )
}