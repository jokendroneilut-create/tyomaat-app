import type { SupabaseClient } from "@supabase/supabase-js"
import { CANONICAL_PHASES, normalizeLegacyPhase } from "./phases"
import { recordPhaseChange } from "./recordPhaseChange"

function phaseOrder(rawPhase: string | null | undefined) {
  const key = normalizeLegacyPhase(rawPhase)
  if (!key) return null
  return CANONICAL_PHASES.find((p) => p.key === key)?.order ?? null
}

/*
 * Kun jo hyväksytyn hankkeen taustalla oleva potentiaalinen hanke saa
 * uutta tietoa (esim. Hilman jatkoilmoitus samasta kilpailutuksesta —
 * tarjouspyyntö muuttuu hankintapäätökseksi), hanke ei enää palaa
 * hyväksyntäjonoon ihmisen nähtäville, koska sen status on jo
 * "approved". Ilman tätä synkronointia vaihe jäisi pysyvästi jumiin
 * hyväksymishetken tilaan, vaikka taustadata tietäisi paremmin.
 * Synkronoidaan vain kun uusi vaihe todella edistää nykyistä (ei koskaan
 * peruuteta taaksepäin), jottei virheellinen/vanhentunut ilmoitus voi
 * vahingossa siirtää hanketta väärään suuntaan.
 */
export async function syncApprovedProject(input: {
  supabase: SupabaseClient
  projectId: string
  newMetadata: Record<string, unknown>
  sourceName?: string | null
}) {
  const { data: project, error } = await input.supabase
    .from("projects")
    .select("id, phase, metadata")
    .eq("id", input.projectId)
    .maybeSingle()

  if (error) throw error
  if (!project) return null

  const newPhaseHint = (input.newMetadata as any)?.phase_hint ?? null
  const existingOrder = phaseOrder(project.phase)
  const newOrder = phaseOrder(newPhaseHint)
  const phaseAdvances =
    newOrder != null && (existingOrder == null || newOrder > existingOrder)

  const mergedPhase = phaseAdvances ? newPhaseHint : project.phase

  const { error: updateError } = await input.supabase
    .from("projects")
    .update({
      phase: mergedPhase,
      last_verified_at: new Date().toISOString(),
      metadata: {
        ...(project.metadata ?? {}),
        ...input.newMetadata,
      },
    })
    .eq("id", input.projectId)

  if (updateError) throw updateError

  if (phaseAdvances) {
    await recordPhaseChange({
      supabase: input.supabase,
      projectId: input.projectId,
      newPhase: mergedPhase,
      previousPhase: project.phase,
      source: "auto_sync",
      sourceName: input.sourceName ?? null,
      reason: "Uusi ilmoitus samasta hankkeesta edisti vaihetta automaattisesti",
    })
  }

  return { phaseAdvances, mergedPhase }
}
