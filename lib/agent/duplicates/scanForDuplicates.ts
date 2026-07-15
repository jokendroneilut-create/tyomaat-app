import { createClient } from "@supabase/supabase-js"
import {
  calculateMatch,
  type MatchableProject,
  type ProjectMatchResult,
} from "@/lib/agent/projectMatcher"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchAllProjects(): Promise<MatchableProject[]> {
  const PAGE_SIZE = 1000
  const rows: MatchableProject[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select(
        "id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata"
      )
      .eq("is_public", true)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    rows.push(...((data ?? []) as MatchableProject[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

/*
 * calculateMatch on viritetty yhden discovery-ehdokkaan täsmäytykseen
 * koko hankejoukkoa vasten, jossa sattumanvarainen "sama sijainti/
 * kaupunki/rakennuttaja" -osuma on harvinainen. Tässä pareittaisessa
 * koko-datan läpikäynnissä sama koodi tuotti paljon vääriä osumia,
 * koska moni hanke on tallennettu vain kaupungin/kaupunginosan
 * tarkkuudella location-kenttään (esim. "Oulu" tai "Nihti") — moni eri
 * hanke jakaa saman arvon ilman että ne ovat sama hanke. Vaaditaan siis
 * lisäksi joko vahva tunniste tai nimi-todiste, ja nimi-todisteen
 * tapauksessa vielä sama kaupunki (ei pelkkä sama maakunta), jotta
 * yleisnimiset hankkeet ("Kerrostalo", "Datakeskus") eri kaupungeissa
 * eivät osu toisiinsa.
 */
function passesDuplicateQualityBar(match: ProjectMatchResult): boolean {
  if (match.confidence < 70) return false

  const hasStrongIdentifier =
    match.reasons.includes("same_permit_number") ||
    match.reasons.includes("same_property_id")

  if (hasStrongIdentifier) return true

  const hasTitleEvidence =
    match.reasons.includes("exact_title") || match.reasons.includes("similar_title")

  return hasTitleEvidence && match.reasons.includes("same_city")
}

export type ScanResult = {
  mode: "full" | "incremental"
  projectsScanned: number
  pairsCompared: number
  candidatesFound: number
}

/*
 * projectIds annettuna: verrataan vain näitä hankkeita (esim. viimeisen
 * viikon aikana luotuja/päivitettyjä) kaikkia julkisia hankkeita vastaan.
 * projectIds puuttuu: täysi pareittainen läpikäynti koko julkisesta
 * hankejoukosta (kertaluontoinen alkuskannaus).
 */
export async function scanForDuplicates(
  options: { projectIds?: string[] } = {}
): Promise<ScanResult> {
  const allProjects = await fetchAllProjects()
  const byId = new Map(allProjects.map((p) => [p.id, p]))

  const targets = options.projectIds
    ? options.projectIds.map((id) => byId.get(id)).filter((p): p is MatchableProject => !!p)
    : allProjects

  const { data: existingPairs, error: existingError } = await supabaseAdmin
    .from("project_duplicate_candidates")
    .select("project_id_a, project_id_b")

  if (existingError) throw existingError

  const seen = new Set(
    (existingPairs ?? []).map((p) => `${p.project_id_a}:${p.project_id_b}`)
  )

  let pairsCompared = 0
  const toInsert: {
    project_id_a: string
    project_id_b: string
    confidence: number
    reasons: string[]
  }[] = []

  for (let i = 0; i < targets.length; i++) {
    const a = targets[i]

    // Täydessä skannauksessa targets === allProjects, joten indeksin
    // jälkeiset riittävät eikä pareja synny kahteen kertaan.
    const compareAgainst = options.projectIds
      ? allProjects
      : allProjects.slice(i + 1)

    for (const b of compareAgainst) {
      if (b.id === a.id) continue

      const [idA, idB] = [a.id, b.id].sort()
      const key = `${idA}:${idB}`
      if (seen.has(key)) continue

      pairsCompared++

      const match = calculateMatch(b, {
        name: a.name,
        city: a.city,
        region: a.region,
        location: a.location,
        permitNumber: a.metadata?.permit_number ?? null,
        propertyId: a.metadata?.property_id ?? null,
        developer: a.developer ?? a.metadata?.developer ?? null,
        buildingType: a.property_type ?? a.metadata?.building_type ?? null,
      })

      seen.add(key)
      if (!match) continue
      if (!passesDuplicateQualityBar(match)) continue

      toInsert.push({
        project_id_a: idA,
        project_id_b: idB,
        confidence: match.confidence,
        reasons: match.reasons,
      })
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("project_duplicate_candidates")
      .upsert(toInsert, {
        onConflict: "project_id_a,project_id_b",
        ignoreDuplicates: true,
      })

    if (insertError) throw insertError
  }

  return {
    mode: options.projectIds ? "incremental" : "full",
    projectsScanned: targets.length,
    pairsCompared,
    candidatesFound: toInsert.length,
  }
}
