import { createClient } from "@supabase/supabase-js"
import {
  calculateMatch,
  type MatchableProject,
  type ProjectMatchResult,
} from "@/lib/agent/projectMatcher"
import {
  buildComparisonBuckets,
  comparisonPartners,
} from "@/lib/agent/duplicates/comparisonBuckets"

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

  /*
   * name_in_description on tarkoituksella POIS tästä listasta. Se on
   * täsmäytyksessä pätevä tekstitodiste, mutta skanneri vertaa hankkeita
   * toisiinsa — ei ehdokasta hankkeeseen — eikä sen vaikutusta pareittaisessa
   * läpikäynnissä ole mitattu. Lisääminen laajentaisi skannerin porttia
   * mittaamatta, mikä on juuri se virhe joka on aiemmin tuottanut vääriä
   * pareja. Jos tämä otetaan mukaan, mittaa ensin ajamalla täysi skannaus.
   */
  const hasTitleEvidence =
    match.reasons.includes("exact_title") ||
    match.reasons.includes("exact_distinctive_title") ||
    match.reasons.includes("similar_title")

  return hasTitleEvidence && match.reasons.includes("same_city")
}

export type ScanResult = {
  mode: "full" | "incremental"
  projectsScanned: number
  pairsCompared: number
  candidatesFound: number
}


/*
 * Ajon kirjaus agent_runsiin. Ilman tätä skannauksen hiljaisuutta ei
 * erottanut toimimattomuudesta: duplikaattitauluun ei tullut riviäkään
 * kuukauteen, eikä mistään näkynyt oliko viikkocron ajanut ja löytänyt nolla
 * paria vai kaatunut aikarajaan (ajo kesti 358 s, maxDuration on 60).
 *
 * Rivi näkyy sellaisenaan /tic/discovery/health -sivun ajolistassa, koska se
 * ei suodata agent_typen mukaan.
 *
 * Kirjauksen epäonnistuminen ei kaada skannausta - seuranta ei saa estää
 * varsinaista työtä. Tässä poiketaan tarkoituksella fact/identity-workereista,
 * jotka heittävät jos agent_runs-insert epäonnistuu.
 */
async function startRun(mode: "full" | "incremental", targetCount: number | null) {
  const { data, error } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent_type: "duplicate_scan",
      source_name: mode === "full" ? "Täysi skannaus" : "Viikkoskannaus",
      status: "started",
      started_at: new Date().toISOString(),
      payload: { mode, targetCount },
    })
    .select("id")
    .single()

  if (error) {
    console.error("duplicate_scan: agent_runs insert epäonnistui", error.message)
    return null
  }

  return data.id as string
}

async function finishRun(
  runId: string | null,
  durationMs: number,
  outcome:
    | { status: "success"; result: ScanResult }
    | { status: "error"; message: string }
) {
  if (!runId) return

  const { error } = await supabaseAdmin
    .from("agent_runs")
    .update({
      status: outcome.status,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      ...(outcome.status === "success"
        ? {
            // documents_* jätetään tyhjäksi: health-sivu otsikoi ne
            // "Documents", eikä pareja kannata näyttää sen alla.
            candidates_created: outcome.result.candidatesFound,
            payload: outcome.result,
          }
        : { error_message: outcome.message }),
    })
    .eq("id", runId)

  if (error) {
    console.error("duplicate_scan: agent_runs update epäonnistui", error.message)
  }
}

export async function scanForDuplicates(
  options: { projectIds?: string[] } = {}
): Promise<ScanResult> {
  const startedAt = Date.now()
  const mode = options.projectIds ? "incremental" : "full"
  const runId = await startRun(mode, options.projectIds?.length ?? null)

  try {
    const result = await runScan(options)
    await finishRun(runId, Date.now() - startedAt, { status: "success", result })
    return result
  } catch (error: any) {
    await finishRun(runId, Date.now() - startedAt, {
      status: "error",
      message: error?.message ?? String(error),
    })
    throw error
  }
}

/*
 * projectIds annettuna: verrataan vain näitä hankkeita (esim. viimeisen
 * viikon aikana luotuja/päivitettyjä) kaikkia julkisia hankkeita vastaan.
 * projectIds puuttuu: täysi pareittainen läpikäynti koko julkisesta
 * hankejoukosta (kertaluontoinen alkuskannaus).
 */
async function runScan(
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

  const buckets = buildComparisonBuckets(allProjects)

  for (const a of targets) {
    /*
     * Pari käydään läpi vain kerran kumpaankin suuntaan: avain on
     * järjestetty ja merkitään nähdyksi heti, joten täysi skannaus ei
     * tarvitse enää erillistä slice(i + 1) -puolitusta.
     */
    for (const b of comparisonPartners(a, buckets)) {
      const [idA, idB] = [a.id, b.id].sort()
      const key = `${idA}:${idB}`
      if (seen.has(key)) continue
      seen.add(key)

      pairsCompared++

      const match = calculateMatch(b, {
        name: a.name,
        sourceTitle: (a.metadata?.source_title as string | null) ?? null,
        city: a.city,
        region: a.region,
        location: a.location,
        permitNumber: a.metadata?.permit_number ?? null,
        propertyId: a.metadata?.property_id ?? null,
        developer: a.developer ?? a.metadata?.developer ?? null,
        buildingType: a.property_type ?? a.metadata?.building_type ?? null,
      })

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

  /*
   * Kirjoitus paloissa. Täysi skannaus (mode=full) voi löytää satoja tai
   * tuhansia pareja, ja koko joukon työntäminen yhtenä upsertina kaatoi ajon
   * - virhe tuli vasta minuuttien vertailutyön jälkeen, jolloin kaikki tulos
   * meni hukkaan. Paloittain kirjoitettuna aiemmat erät jäävät talteen.
   *
   * Inkrementaalisessa viikkoajossa pareja on vähän eikä tällä ole väliä,
   * mutta sama koodi palvelee molempia.
   */
  const INSERT_CHUNK = 500
  let inserted = 0

  /*
   * Uudelleenyritys verkkovirheelle. Täysi skannaus vertailee miljoonia
   * pareja ja kestää kymmeniä minuutteja, joten kirjoitus tapahtuu vasta
   * pitkän ajon päätteeksi - siinä vaiheessa yksi katkennut yhteys hukkaisi
   * koko työn. Mitattu tapaus: "TypeError: fetch failed" 35 parin
   * kirjoituksessa ~20 minuutin laskennan jälkeen.
   */
  async function writeChunk(chunk: typeof toInsert): Promise<void> {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error } = await supabaseAdmin
          .from("project_duplicate_candidates")
          .upsert(chunk, {
            onConflict: "project_id_a,project_id_b",
            ignoreDuplicates: true,
          })

        if (!error) return
        lastError = error
      } catch (err) {
        lastError = err
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
      }
    }

    const message =
      (lastError as any)?.message ?? String(lastError ?? "tuntematon virhe")

    throw new Error(
      `Duplikaattiparien kirjoitus epäonnistui kolmen yrityksen jälkeen ` +
        `(${inserted}/${toInsert.length} kirjoitettu): ${message}`
    )
  }

  for (let from = 0; from < toInsert.length; from += INSERT_CHUNK) {
    const chunk = toInsert.slice(from, from + INSERT_CHUNK)
    await writeChunk(chunk)
    inserted += chunk.length
  }

  return {
    mode: options.projectIds ? "incremental" : "full",
    projectsScanned: targets.length,
    pairsCompared,
    candidatesFound: toInsert.length,
  }
}
