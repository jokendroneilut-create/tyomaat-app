import { createClient } from "@supabase/supabase-js"
import { findProjectMatchDetailed } from "@/lib/agent/projectMatcher"
import { inferPhaseFromText } from "@/lib/projects/inferPhaseFromText"
import { parseEstimatedCompletionDate } from "@/lib/agent/parseFinnishCompletionDate"
import {
  inferCompletionDateFromText,
  isPastDate,
} from "@/lib/projects/inferCompletionDateFromText"
import {
  textIndicatesCompletion,
  stripCompletionWords,
} from "@/lib/projects/detectCompletionFromText"
import { PHASE_LABELS, phaseAdvances } from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"
import { shouldUnexpire } from "@/lib/projects/tenderExpiry"
import {
  awardWinnersFromMetadata,
  mergeCompanyNames,
} from "@/lib/projects/projectCompanies"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { stripCompanyPrefixFromHeadline } from "@/lib/agent/stripCompanyPrefix"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { decodeHtmlEntities } from "@/lib/agent/htmlEntities"

/*
 * Yrityslähteiden kandidaatin tuonti. Logiikka oli aiemmin suoraan
 * /api/agent/import -reitin sisällä, jolloin sitä pystyi kutsumaan vain
 * HTTP:n yli. Vanha keräysajo teki juuri niin: kaksi itsekutsua jokaista
 * kandidaattia kohden (seen-source + import), eli 388 kandidaatilla 776
 * peräkkäistä pyyntöä samalle palvelimelle. Se söi aikabudjetin ennen kuin
 * puoletkaan lähteistä ehti ajoon.
 *
 * Nyt sama logiikka on funktiona, jota discovery-putken kerääjä kutsuu
 * suoraan. Reitti säilyy ohuena kuorena taaksepäin yhteensopivuuden vuoksi.
 * Käytös on tarkoituksella identtinen - tämä on siirto, ei uudelleenkirjoitus.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/*
 * Tämän putken lähde (yritysten lehdistötiedotteet) ei anna luotettavaa
 * tietoa lupanumeron alkuperästä, joten tyyppi päätellään parhaan
 * yrityksen mukaan tunnetuista muodoista. Jos mikään ei täsmää, lupa-
 * numeroa ei tyypitetä tarkkaan tunnistetauluun — sumea matcheri
 * (findProjectMatchDetailed) hoitaa täsmäytyksen silloin edelleen.
 */
function guessPermitIdentifierType(value: string | null): IdentifierType | null {
  if (!value) return null
  if (/^LP-\d+-\d{4}-\d+$/i.test(value)) return "lupapiste_permit_number"
  if (/^\d{4}-\d+$/.test(value)) return "hilma_notice_number"
  return null
}

/*
 * Sama 24 tunnin ikkuna kuin /api/agent/seen-source -reitillä: jos sama
 * source_url on nähty vuorokauden sisällä, kandidaattia ei tuoda uudelleen.
 */
export async function isSourceUrlSeenRecently(
  sourceUrl: string | null | undefined
): Promise<boolean> {
  if (!sourceUrl) return false

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("project_sources")
    .select("id,last_seen_at")
    .eq("source_url", sourceUrl)
    .order("last_seen_at", { ascending: false })
    .limit(1)

  if (error) throw error

  const lastSeenAt = data?.[0]?.last_seen_at
  if (!lastSeenAt) return false

  return Date.now() - new Date(lastSeenAt).getTime() < 24 * 60 * 60 * 1000
}

/*
 * Sama tarkistus koko erälle yhdellä kyselyllä. Yksi lähde voi tuottaa
 * satoja kandidaatteja (stt_haku 253), ja yksitellen kysyttynä pelkkä
 * nähty-tarkistus oli satoja peräkkäisiä tietokantakierroksia.
 *
 * .in() pilkotaan sadan palasiin, koska pitkä IN-lista kasvattaa URL:n
 * yli PostgRESTin rajan.
 */
export async function findRecentlySeenSourceUrls(
  urls: (string | null | undefined)[]
): Promise<Set<string>> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))]
  const seen = new Set<string>()

  if (unique.length === 0) return seen

  const supabase = getSupabase()
  const cutoff = Date.now() - 24 * 60 * 60 * 1000

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)

    const { data, error } = await supabase
      .from("project_sources")
      .select("source_url,last_seen_at")
      .in("source_url", chunk)

    if (error) throw error

    for (const row of data ?? []) {
      if (!row.last_seen_at) continue
      if (new Date(row.last_seen_at).getTime() >= cutoff) {
        seen.add(row.source_url)
      }
    }
  }

  return seen
}

export type ImportResult = {
  status: string
  reason?: string
  project_id?: string
  potential_project_id?: string
  action?: string
}

/*
 * Täsmäytys vertaa kandidaattia koko projects-tauluun. Yksittäisessä
 * HTTP-kutsussa se on yksi haku, mutta erässä (yksi lähde voi tuottaa
 * satoja kandidaatteja) se olisi yhtä monta täyttä taulunlukua. Kutsuja
 * voi siksi hakea listan kerran ja antaa sen tässä.
 *
 * Huom: erän aikana tehdyt päivitykset eivät näy esiladatussa listassa.
 * Se on tarkoituksellista - täsmäytys perustuu nimeen, kaupunkiin ja
 * osoitteeseen, joita tuonti ei muuta.
 */
/*
 * Täsmäytyslista on sama kaikille saman ajon lähteille, ja yksi haku on
 * n. 6 MB. Ilman välimuistia kuuden legacy-lähteen ajo hakisi sen kuudesti
 * eli ~37 MB - Supabasen ilmaistason egress-kiintiö on 5 GB kuukaudessa.
 *
 * Elinikä on lyhyt tarkoituksella: ajon aikana tehdyt muutokset eivät näy
 * välimuistissa, mutta täsmäytys perustuu nimeen, kaupunkiin ja osoitteeseen,
 * joita tuonti ei muuta. Viisi minuuttia kattaa yhden putkiajon.
 */
let matchingCache: { rows: any[]; loadedAt: number } | null = null
const MATCHING_CACHE_MS = 5 * 60 * 1000

export function clearProjectsForMatchingCache() {
  matchingCache = null
}

export async function loadProjectsForMatching(): Promise<any[]> {
  if (matchingCache && Date.now() - matchingCache.loadedAt < MATCHING_CACHE_MS) {
    return matchingCache.rows
  }

  const supabase = getSupabase()

  /*
   * Sivutus on pakollinen: PostgREST palauttaa enintään 1000 riviä myös
   * ilman .limit()-kutsua, joten aiempi haku näki vain 1000 hanketta
   * 4078:sta. Täsmäytys ohitti siis kolme neljäsosaa hankekannasta, ja
   * kandidaatti joka kuului olemassa olevaan hankkeeseen päätyi silti
   * uutena ehdokkaana jonoon.
   *
   * Koko metadata-kenttää EI haeta, koska se on 58 % siirretystä datasta.
   * Matcher lukee siitä vain seitsemää avainta (projectMatcher.ts), joten
   * ne poimitaan JSON-poluilla ja kootaan takaisin metadata-olioksi -
   * täsmäytys näkee siis saman kuin ennen, mutta siirto on murto-osa.
   * additional_info jää mukaan, koska matcher käyttää sitä kuvauksena.
   */
  const PAGE = 1000
  const rows: any[] = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id,name,city,region,location,phase,completed_at,status,developer,builder," +
          "property_type,estimated_completion,additional_info," +
          "meta_permit_number:metadata->>permit_number," +
          "meta_property_id:metadata->>property_id," +
          "meta_developer:metadata->>developer," +
          "meta_building_type:metadata->>building_type," +
          "meta_source_title:metadata->>source_title," +
          "meta_description:metadata->>description," +
          "meta_also_known_as:metadata->also_known_as," +
          "meta_merged_into:metadata->>merged_into_project_id"
      )
      /*
       * Yhdistetty hanke ei ole enää täsmäytyksen kohde: siihen kirjoitettu
       * rikastus jäisi piilotetulle riville näkymättä. Säilyvä hanke saa
       * yhdistämisessä myös poistuvan nimen also_known_as-kenttään, joten
       * osuma löytyy silti.
       */
      .is("metadata->>merged_into_project_id", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data?.length) break

    for (const row of data as any[]) {
      const {
        meta_permit_number,
        meta_property_id,
        meta_developer,
        meta_building_type,
        meta_source_title,
        meta_description,
        meta_also_known_as,
        meta_merged_into,
        ...rest
      } = row

      rows.push({
        ...rest,
        metadata: {
          permit_number: meta_permit_number,
          property_id: meta_property_id,
          developer: meta_developer,
          building_type: meta_building_type,
          source_title: meta_source_title,
          description: meta_description,
          also_known_as: meta_also_known_as,
        },
      })
    }

    if (data.length < PAGE) break
  }

  matchingCache = { rows, loadedAt: Date.now() }

  return rows
}

/*
 * Osuneen hankkeen metadata ja additional_info. Tarvitaan vain silloin kun
 * kandidaatti täsmää olemassa olevaan hankkeeseen, jolloin vanha metadata
 * yhdistetään uuteen - eli korkeintaan kerran per kandidaatti eikä koko
 * listalle.
 */
export async function loadProjectDetailsForMerge(
  projectId: string
): Promise<{ metadata: any; additional_info: string | null }> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from("projects")
    .select("metadata,additional_info")
    .eq("id", projectId)
    .maybeSingle()

  return {
    metadata: data?.metadata ?? null,
    additional_info: data?.additional_info ?? null,
  }
}

export async function importCandidate(
  body: any,
  options: { projects?: any[] } = {}
): Promise<ImportResult> {
  if (!body.name || body.name.trim().length < 5) {
    return { status: "invalid_name" }
  }

  if (/^\d+$/.test(body.name.trim())) {
    return { status: "invalid_name" }
  }

  if (body.name.trim().toLowerCase() === "lue lisää") {
    return { status: "invalid_name" }
  }

  const supabase = getSupabase()

  /*
   * Valmistumisesta kertova tiedote tunnistetaan tekstistä, koska yksikään
   * yritysfetcher ei aseta completed-lippua itse. Lippu ohjaa alempana
   * osuneen hankkeen tilan valmiiksi - samaa polkua kuin lähteen oma
   * merkintä käyttäisi.
   */
  const completionFromText = textIndicatesCompletion(
    body.name,
    body.metadata?.description
  )

  const isCompleted = Boolean(body.completed) || completionFromText

  /*
   * Täsmäytys tehdään otsikolla josta valmistumissana on poistettu: se sana
   * pudotti muuten identtisen otsikon osumasta pois, eli uutinen jo tunnetun
   * hankkeen valmistumisesta ei löytänyt sitä hanketta.
   */
  const matchTitle = stripCompletionWords(body.name)

  /*
   * Valmistumisaika leipätekstistä. Poimitaan kerran ja käytetään sekä uuden
   * hankkeen luonnissa että olemassa olevan täydennyksessä.
   */
  const textCompletionDate =
    parseEstimatedCompletionDate(
      `${body.name ?? ""} ${body.description ?? body.metadata?.description ?? ""}`
    ) ?? null

  const candidate = {
    name: matchTitle || body.name || null,
    city: body.city || null,
    /*
     * Maakunta johdetaan kunnasta silloin kun lähde ei sitä anna. Valtaosa
     * lähteistä palauttaa region: null, koska tiedotteessa lukee vain
     * kaupunki - ja kenttä jäi silloin pysyvästi tyhjäksi, vaikka kunta oli
     * tiedossa. Sama johtaminen tehdään jo jälkikäteen
     * (scripts/backfill-region.ts); tämä estää aukon syntymisen.
     */
    region: body.region || getMunicipalityByName(body.city)?.region || null,
    location: body.location || null,
    permitNumber: body.permit_number ?? body.metadata?.permit_number ?? null,
    propertyId: body.property_id ?? body.metadata?.property_id ?? null,
    developer: body.developer ?? body.metadata?.developer ?? null,
    /*
     * Urakoitsija erikseen rakennuttajasta: lähde voi tietää molemmat, esim.
     * kun rakennusliike tiedottaa omasta urakastaan ja tilaaja mainitaan
     * tekstissä. Ilman tätä kenttä katosi eikä pääurakoitsija näkynyt
     * hankekortilla.
     */
    builder: body.builder ?? body.metadata?.builder ?? null,
    buildingType:
      body.property_type ??
      body.building_type ??
      body.metadata?.building_type ??
      null,
    /*
     * Voittajat kulkevat omana kenttänään, koska niitä voi olla monta:
     * puitesopimuksessa valitaan kerralla kahdeksankin toimittajaa, eikä
     * yhtä pääurakoitsijaa voi silloin nimetä.
     */
    winners: Array.isArray(body.winners) ? body.winners : null,
    /*
     * Lähde ei useinkaan anna valmistumisaikaa erillisenä kenttänä, vaikka se
     * lukee leipätekstissä ("kohde valmistuu keväällä 2027"). Mitattu ennen
     * tätä: estimated_completion oli täytetty 24 hankkeella 4412:sta (1 %),
     * kun teksti antoi sen 109:lle.
     *
     * Kenttää tarvitaan, koska auto-complete-projects-cron siirtää hankkeen
     * valmistuneeksi vasta kun päivä on mennyt - ilman päivämäärää hanke jää
     * ikuisesti rakenteille.
     *
     * parseEstimatedCompletionDate vaatii TULEVAN aikamuodon ("valmistuu",
     * ei "valmistui"), mikä on tässä oikea rajaus: mitattuna menneen muodon
     * osumista yksikään ei koskenut hanketta itseään vaan purettavaa vanhaa
     * rakennusta, kaavaselvitystä tai naapurirakennusta.
     */
    estimatedCompletion:
      body.estimated_completion ??
      body.metadata?.estimated_completion ??
      textCompletionDate,
    description: body.description ?? body.metadata?.description ?? null,
  }

  const candidateIdentifiers: { type: IdentifierType; value: string | null }[] = [
    { type: "property_id", value: candidate.propertyId },
  ]

  const permitIdentifierType = guessPermitIdentifierType(candidate.permitNumber)
  if (permitIdentifierType) {
    candidateIdentifiers.push({
      type: permitIdentifierType,
      value: candidate.permitNumber,
    })
  }

  const exactMatch = await findByIdentifiers(candidateIdentifiers, supabase)

  const projects = options.projects ?? (await loadProjectsForMatching())

  let detailedMatch = findProjectMatchDetailed(projects || [], candidate)

  if (exactMatch?.projectId) {
    const exactProject = (projects || []).find((p) => p.id === exactMatch.projectId)
    if (exactProject) {
      detailedMatch = {
        project: exactProject,
        confidence: 100,
        reasons: ["same_permit_number"],
      }
    }
  }

  const match =
    detailedMatch && detailedMatch.confidence >= 70 ? detailedMatch.project : null

  if (match) {
    const matchedProjectId = match.id

    /*
     * Vaihe saa vain edetä. Aiemmin uusi arvaus voitti aina, jolloin vanha
     * uutinen tai suunnitteluvaiheesta kertova tiedote siirsi käynnissä
     * olevan työmaan takaisin suunnitteluun - myös silloin kun vaihe oli
     * asetettu käsin hyväksynnässä.
     */
    const matchedNewPhase = phaseAdvances(match.phase, body.phase)
      ? body.phase
      : match.phase

    /*
     * Täsmäytyslista ei enää kanna metadataa (se oli 58 % siirretystä
     * datasta), joten olemassa oleva metadata haetaan vasta tässä - eli
     * vain osuneelle hankkeelle. Ilman tätä yhdistäminen alempana
     * pyyhkisi vanhat metadata-kentät tyhjiksi.
     */
    const existing = await loadProjectDetailsForMerge(matchedProjectId)
    match.metadata = existing.metadata

    /*
     * Vanhentunut kilpailutus herää henkiin kun voittaja selviää. Ratkaisu
     * tehdään yhdistetystä metadatasta, koska voittajatieto tulee juuri tässä
     * ilmoituksessa (body) eikä ole vielä hankkeella.
     */
    const mergedMetadata = {
      ...(match.metadata ?? {}),
      ...(body.metadata ?? {}),
    }
    const unexpire = shouldUnexpire(match.status, mergedMetadata)
    const nowIso = new Date().toISOString()

    await supabase
      .from("projects")
      .update({
        last_verified_at: new Date().toISOString(),
        city: body.city || match.city || null,
        region: body.region || match.region || null,
        location: body.location || match.location || null,
        phase: matchedNewPhase || undefined,
        developer: body.developer || match.developer || null,
        // Tunnettua urakoitsijaa ei ylikirjoiteta; vain tyhjä täytetään.
        builder: match.builder || candidate.builder || null,
        property_type:
          body.property_type || body.building_type || match.property_type || null,
        /*
         * Tekstistä poimittu aika on viimeisenä: tunnettua arviota ei
         * ylikirjoiteta, vain tyhjä täytetään.
         */
        estimated_completion:
          body.estimated_completion ||
          body.metadata?.estimated_completion ||
          match.estimated_completion ||
          textCompletionDate ||
          null,
        /*
         * needs_review nousee kun hanke merkitään valmiiksi, jotta ihminen
         * vahvistaa päätelmän - erityisesti kun se tuli tekstistä eikä
         * lähteen omasta tilamerkinnästä.
         */
        needs_review: isCompleted ? true : false,
        source_confidence: body.confidence ?? null,
        status: isCompleted
          ? "completed"
          : unexpire
            ? "active"
            : match.status ?? "active",
        completed_at: isCompleted
          ? new Date().toISOString()
          : match.completed_at ?? null,
        metadata: {
          ...(match.metadata ?? {}),
          ...(body.metadata ?? {}),
          permit_number:
            body.permit_number ??
            body.metadata?.permit_number ??
            match.metadata?.permit_number ??
            null,
          property_id:
            body.property_id ??
            body.metadata?.property_id ??
            match.metadata?.property_id ??
            null,
          developer:
            body.developer ??
            body.metadata?.developer ??
            match.metadata?.developer ??
            null,
          building_type:
            body.building_type ??
            body.property_type ??
            body.metadata?.building_type ??
            match.metadata?.building_type ??
            null,
          last_source_name: body.source_name || "agent",
          last_source_url: body.source_url || null,
          last_imported_at: new Date().toISOString(),
          /*
           * Voittajat talteen listanäkymää varten: se lukee
           * related_companies-kentän suoraan, kun taas source_history on
           * liian iso haettavaksi listaan. Usean osaurakan hankinnassa vain
           * ensimmäinen voittaja mahtuu builder-sarakkeeseen.
           */
          ...(() => {
            const related = mergeCompanyNames(
              Array.isArray(match.metadata?.related_companies)
                ? match.metadata.related_companies
                : [],
              Array.isArray(body.metadata?.related_companies)
                ? body.metadata.related_companies
                : [],
              awardWinnersFromMetadata(match.metadata),
              awardWinnersFromMetadata(body.metadata)
            )
            return related.length > 0 ? { related_companies: related } : {}
          })(),
          // Vanhenemismerkinnät pois, jottei kortti väitä hanketta yhä
          // vanhentuneeksi. Peruste jää talteen unexpired_reason-kenttään.
          ...(unexpire
            ? {
                expired_at: null,
                expired_reason: null,
                unexpired_at: nowIso,
                unexpired_reason: "Voittaja ratkesi vanhenemisen jälkeen",
              }
            : {}),
        },
      })
      .eq("id", matchedProjectId)

    for (const identifier of candidateIdentifiers) {
      await linkIdentifier({
        type: identifier.type,
        value: identifier.value,
        projectId: matchedProjectId,
        sourceName: body.source_name || "agent",
        supabase,
      })
    }

    await recordPhaseChange({
      supabase,
      projectId: matchedProjectId,
      newPhase: matchedNewPhase,
      previousPhase: match.phase,
      source: "agent_import",
      sourceName: body.source_name || "agent",
    })

    await supabase.from("project_import_events").insert({
      source_name: body.source_name || "agent",
      source_url: body.source_url || null,
      normalized_payload: body,
      match_status: "matched",
      matched_project_id: matchedProjectId,
      action_taken: "verified",
      match_confidence: detailedMatch?.confidence ?? null,
      match_reasons: detailedMatch?.reasons ?? [],
    })

    if (body.source_url) {
      await supabase.from("project_sources").upsert(
        {
          project_id: matchedProjectId,
          source_name: body.source_name || "agent",
          source_url: body.source_url,
          last_seen_at: new Date().toISOString(),
          confidence: body.confidence ?? null,
        },
        {
          onConflict: "project_id,source_name,source_url",
        }
      )
    }

    return { status: "matched", project_id: matchedProjectId }
  }

  if (body.source_url) {
    const { data: existing } = await supabase
      .from("project_import_events")
      .select("id")
      .eq("source_url", body.source_url)
      .eq("action_taken", "queued_for_review")
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase.from("project_import_events").insert({
        source_name: body.source_name || "agent",
        source_url: body.source_url,
        normalized_payload: body,
        match_status: "duplicate_source",
        matched_project_id: null,
        action_taken: "skipped",
        reason: "source_url already imported",
        match_confidence: detailedMatch?.confidence ?? null,
        match_reasons: detailedMatch?.reasons ?? [],
      })

      return {
        status: "duplicate_source",
        reason: "source_url already imported",
      }
    }
  }

  /*
   * Yrityksen lehdistötiedote saattaa itse kuulostaa käynnissä olevalta
   * ("Työt käynnistyvät tammikuussa 2025...") vaikka tekstissä mainittu
   * arvioitu valmistumisaika on jo mennyt kokoamishetkellä - lähdesivu ei
   * itse päivity. body.completed kattaa vain lähteen OMAN tilamerkinnän;
   * tämä poimii vielä leipätekstistä mainitun päivämäärän ja estää yhtä
   * lailla jo vanhentuneiden hankkeiden päätymisen TIC-jonoon.
   */
  const inferredCompletionDate = inferCompletionDateFromText(
    `${body.name ?? ""} ${body.metadata?.description ?? ""}`
  )
  const isStaleCompletion = isPastDate(inferredCompletionDate)

  /*
   * Tänne päädytään vain kun täsmäävää hanketta EI löytynyt. Valmistumisesta
   * kertova uutinen tuntemattomasta hankkeesta ei ole mahdollisuus, joten
   * sitä ei viedä jonoon - sama päätös kuin ennenkin, nyt myös silloin kun
   * valmistuminen tunnistettiin sanamuodosta eikä lähteen lipusta.
   */
  if (isCompleted || isStaleCompletion) {
    const reason = completionFromText && !body.completed
      ? "text indicates project already completed"
      : isStaleCompletion && !body.completed
        ? `estimated completion (${inferredCompletionDate}) already passed`
        : "completed project not inserted as new"

    await supabase.from("project_import_events").insert({
      source_name: body.source_name || "agent",
      source_url: body.source_url || null,
      normalized_payload: body,
      match_status: "completed_source",
      matched_project_id: null,
      action_taken: "skipped",
      reason,
      match_confidence: detailedMatch?.confidence ?? null,
      match_reasons: detailedMatch?.reasons ?? [],
    })

    return { status: "skipped_completed", reason }
  }

  const inferredPhaseKey = !body.phase
    ? inferPhaseFromText(
        body.name,
        body.metadata?.description ?? body.metadata?.operation,
        body.metadata
      )
    : null

  const insertPhase =
    body.phase ||
    (inferredPhaseKey ? PHASE_LABELS[inferredPhaseKey] : PHASE_LABELS.planning)

  /*
   * Ei täsmäytystä olemassa olevaan julkiseen hankkeeseen — aiemmin
   * tämä kirjoitti suoraan projects-tauluun (is_public: true) ilman
   * ihmisen katselua. Nyt reititetään sama TIC-hyväksyntäjonon läpi
   * kuin kaikki muutkin lähteet: resolvePotentialProject tekee oman
   * täsmäytyksensä potential_projects-taulua vasten (tunniste/lupa-
   * numero/kiinteistötunnus/osoite), joten sama hanke ei monistu
   * jonoon useasta yrityssivun tiedotteesta tai muusta lähteestä.
   */
  /*
   * Entiteetit puretaan keskitetysti ennen otsikon siistimistä. Jokainen
   * jäsentäjä purki aiemmin vain ne entiteetit jotka sen omassa aineistossa
   * oli sattumalta nähty, joten uusi entiteetti päätyi otsikkoon
   * sellaisenaan - mitattu "Soukankuja 10&ndash;12" (Espoo),
   * "Kuopion yleiskaava &#x2F; ..." (kaavalähde).
   */
  const cleanedTitle = stripCompanyPrefixFromHeadline(decodeHtmlEntities(body.name))

  const result = await resolvePotentialProject({
    title: cleanedTitle,
    municipality: body.city,
    address: body.location,
    propertyId: candidate.propertyId,
    permitNumber: candidate.permitNumber,
    sourceName: body.source_name || "agent",
    identifiers: candidateIdentifiers,
    metadata: {
      ...(body.metadata ?? {}),
      source: body.source_name || "agent",
      source_name: body.source_name || "agent",
      source_url: body.source_url || null,
      resolver: "legacyCompanyResolver",
      operation: cleanedTitle,
      description: body.description ?? body.metadata?.description ?? null,
      developer: candidate.developer,
      builder: candidate.builder,
      building_type: candidate.buildingType,
      winners: candidate.winners,
      region: candidate.region,
      permit_number: candidate.permitNumber,
      property_id: candidate.propertyId,
      phase_hint: insertPhase,
      estimated_completion: candidate.estimatedCompletion,
    },
  })

  await supabase.from("project_import_events").insert({
    source_name: body.source_name || "agent",
    source_url: body.source_url || null,
    normalized_payload: body,
    match_status:
      result.action === "updated_existing" ? "matched_candidate" : "new",
    matched_project_id: null,
    action_taken: "queued_for_review",
    reason: null,
    match_confidence: detailedMatch?.confidence ?? null,
    match_reasons: detailedMatch?.reasons ?? [],
  })

  return {
    status: "queued_for_review",
    potential_project_id: result.potentialProject.id,
    action: result.action,
  }
}
