import type { SupabaseClient } from "@supabase/supabase-js"
import { phaseAdvances as phaseAdvancesFrom } from "./phases"
import { recordPhaseChange } from "./recordPhaseChange"
import { shouldUnexpire } from "./tenderExpiry"
import { resolveProjectCost } from "./resolveProjectCost"
import {
  awardWinnersFromMetadata,
  mergeCompanyNames,
} from "./projectCompanies"

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
    .select("id, phase, status, metadata, estimated_cost")
    .eq("id", input.projectId)
    .maybeSingle()

  if (error) throw error
  if (!project) return null

  const newPhaseHint = (input.newMetadata as any)?.phase_hint ?? null
  const phaseAdvances = phaseAdvancesFrom(project.phase, newPhaseHint)

  const mergedPhase = phaseAdvances ? newPhaseHint : project.phase

  const baseMetadata = {
    ...(project.metadata ?? {}),
    ...input.newMetadata,
  }

  /*
   * Voittajat talteen related_companies-kenttään. Usean osaurakan hankinnassa
   * jokainen ilmoitus tuo oman voittajansa, ja aiemmin vain ensimmäinen päätyi
   * builder-sarakkeeseen — loput jäivät näkymättä. Listanäkymä lukee
   * related_companies-kentän suoraan, kun taas source_history on liian iso
   * haettavaksi listaan.
   */
  const relatedCompanies = mergeCompanyNames(
    Array.isArray(baseMetadata.related_companies)
      ? baseMetadata.related_companies
      : [],
    awardWinnersFromMetadata(baseMetadata)
  )

  /*
   * Euromääräinen arvo myös jo hyväksytylle hankkeelle.
   *
   * Tämä reitti päivitti aiemmin vain metadatan, joten Hilman jälki-ilmoituksen
   * mukanaan tuoma `contract_value` jäi metadataan eikä koskaan päätynyt
   * `estimated_cost`-sarakkeeseen, jota asiakas näkee. Mitattu 15.8.2026: 105
   * hanketta joilla oli sopimusarvo, ja niistä 104:llä sarake oli tyhjä —
   * tämä puuttuva kytkentä oli syy.
   *
   * Sopimusarvo on toteutunut hinta, joten se saa korvata aiemman arvion;
   * käänteinen suunta on estetty `resolveProjectCost`issa.
   */
  const resolvedCost = resolveProjectCost({
    contractValue: baseMetadata.contract_value,
    text: [baseMetadata.description, baseMetadata.operation]
      .filter(Boolean)
      .join(" "),
    existingCost: project.estimated_cost,
    existingSource: (project.metadata as any)?.cost_source,
  })

  const costChanged =
    resolvedCost !== null &&
    Number(resolvedCost.estimated_cost) !== Number(project.estimated_cost ?? 0)

  const mergedMetadata = {
    ...baseMetadata,
    ...(relatedCompanies.length > 0
      ? { related_companies: relatedCompanies }
      : {}),
    ...(resolvedCost
      ? {
          estimated_cost: resolvedCost.estimated_cost,
          cost_source: resolvedCost.cost_source,
        }
      : {}),
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
      ...(costChanged ? { estimated_cost: resolvedCost!.estimated_cost } : {}),
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
