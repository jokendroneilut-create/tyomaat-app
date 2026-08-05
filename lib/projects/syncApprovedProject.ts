import type { SupabaseClient } from "@supabase/supabase-js"
import { phaseAdvances as phaseAdvancesFrom } from "./phases"
import { recordPhaseChange } from "./recordPhaseChange"
import { shouldUnexpire } from "./tenderExpiry"

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
    .select("id, phase, status, metadata")
    .eq("id", input.projectId)
    .maybeSingle()

  if (error) throw error
  if (!project) return null

  const newPhaseHint = (input.newMetadata as any)?.phase_hint ?? null
  const phaseAdvances = phaseAdvancesFrom(project.phase, newPhaseHint)

  const mergedPhase = phaseAdvances ? newPhaseHint : project.phase

  const mergedMetadata = {
    ...(project.metadata ?? {}),
    ...input.newMetadata,
  }

  /*
   * Sama sääntö kuin agentin tuonnissa: vanhentunut kilpailutus palaa
   * aktiiviseksi kun voittaja selviää. Tämä reitti kattaa jo hyväksytyt
   * hankkeet, jotka eivät enää palaa katselmointijonoon.
   */
  const unexpire = shouldUnexpire(project.status, mergedMetadata)
  const nowIso = new Date().toISOString()

  const { error: updateError } = await input.supabase
    .from("projects")
    .update({
      phase: mergedPhase,
      last_verified_at: nowIso,
      ...(unexpire ? { status: "active" } : {}),
      metadata: unexpire
        ? {
            ...mergedMetadata,
            expired_at: null,
            expired_reason: null,
            unexpired_at: nowIso,
            unexpired_reason: "Voittaja ratkesi vanhenemisen jälkeen",
          }
        : mergedMetadata,
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
