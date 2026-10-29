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

/* PostgRESTin sivu on 1000 riviä; haetaan sivuttaen kunnes jono loppuu. */
const SIVU = 1000

/* Yhteen `.in()`-kyselyyn mahtuva tunnistemäärä; pidempi URL katkeaa. */
const TUNNISTEITA_KERRALLA = 100

/**
 * Kaikki katselmointia odottavat kaksoiskappaleparit.
 *
 * JONOSTA EI SAA KADOTA PAREJA (D-358).
 *
 * Aiemmin tämä otti `limit 100` luottamuksen mukaan laskevasti. Kun jonoon
 * vietiin 39 saman osoitteen paria, joista 26 sai täsmäyttimeltä nollan,
 * sadan rivin katto oli yhtäkkiä lähellä - ja katon ylittävä pari olisi
 * kadonnut näkymästä ilman mitään merkkiä siitä. Navigaation lukumäärä
 * olisi silti sanonut "51", koska se lasketaan erikseen.
 *
 * Kaksi erillistä syytä kadota, molemmat korjattu:
 *
 * 1. **Katto.** Haku sivuttaa nyt koko jonon läpi. Sivu vertaa pituutta
 *    `getPendingDuplicateCount`in lukuun ja kertoo, jos ne eroavat.
 * 2. **Järjestys ilman ratkaisijaa.** Pelkkä `confidence desc` ei määrää
 *    järjestystä, kun 26 rivillä on sama luku. Sivutuksessa se tarkoittaa,
 *    että sama rivi voi tulla kahdesti ja toinen jäädä kokonaan pois.
 *    Ratkaisijaksi `created_at`, ja viimeiseksi `id`, joka on uniikki.
 */
export async function getDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const rows: {
    id: string
    created_at: string
    project_id_a: string
    project_id_b: string
    confidence: number
    reasons: string[] | null
  }[] = []

  for (let alku = 0; ; alku += SIVU) {
    const { data, error } = await supabaseAdmin
      .from("project_duplicate_candidates")
      .select("id, created_at, project_id_a, project_id_b, confidence, reasons")
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(alku, alku + SIVU - 1)

    if (error) throw error

    const sivu = data ?? []
    rows.push(...sivu)
    if (sivu.length < SIVU) break
  }

  if (rows.length === 0) return []

  const projectIds = [
    ...new Set(rows.flatMap((r) => [r.project_id_a, r.project_id_b])),
  ]

  /*
   * Hankkeita on kaksi per pari, joten tunnisteet ylittävät yhden kyselyn
   * rajan jo 51 parilla. Pilkotaan - muuten osa hankkeista jäisi hakematta
   * ja pari näyttäisi listalla tyhjältä kortilta.
   */
  const projectById = new Map<string, DuplicateProjectInfo>()
  for (let i = 0; i < projectIds.length; i += TUNNISTEITA_KERRALLA) {
    const pala = projectIds.slice(i, i + TUNNISTEITA_KERRALLA)
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, name, city, phase, is_public")
      .in("id", pala)

    if (error) throw error
    for (const p of data ?? []) projectById.set(p.id, p as DuplicateProjectInfo)
  }

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
