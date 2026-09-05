import { createClient } from "@supabase/supabase-js"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"
import { syncApprovedProject } from "@/lib/projects/syncApprovedProject"
import { resolveProjectCost } from "@/lib/projects/resolveProjectCost"
import {
  extractFloorAreaFromText,
  parseAlaTeksti,
} from "@/lib/projects/extractFloorAreaFromText"
import { gateCandidateRelevance } from "@/lib/agent/quality/gateCandidateRelevance"
import { resolveBuildingType } from "@/lib/agent/quality/resolveBuildingType"
import {
  inferCompletionDateFromText,
  isPastDate,
} from "@/lib/projects/inferCompletionDateFromText"
import {
  isNonConstructionZoning,
  hasNonConstructionZoningDisclaimer,
} from "@/lib/agent/knowledge/negativeProjects"
import { PHASE_LABELS } from "@/lib/projects/phases"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ResolvePotentialProjectInput = {
  title?: string | null
  municipality?: string | null
  address?: string | null
  propertyId?: string | null
  permitNumber?: string | null
  sourceName?: string | null
  metadata?: Record<string, unknown>
  identifiers?: { type: IdentifierType; value: string | null | undefined }[]
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || null
}

export type SourceHistoryEntry = {
  source_name: string | null
  source_document_id: string | null
  document_url: string | null
  notice_type: string | null
  main_type: string | null
  date_published: string | null
  is_contract_award: boolean
  winners: string[] | null
  seen_at: string
}

/*
 * Kokoaa hankkeelle kumulatiivisen lähdehistorian metadata.source_history-
 * taulukkoon. Aiemmin metadata.source_document_id oli yksi osoitin joka
 * ylikirjoittui aina uusimmalla lähteellä, joten esim. tarjousilmoitus katosi
 * näkyvistä heti kun sama kilpailutus sai jälki-ilmoituksen (voittajan). Tämä
 * lukee vain geneerisiä metadata-kenttiä, joten se toimii kaikille resolvereille.
 * Dedup source_document_id:llä: sama dokumentti ei kerry moneen kertaan, mutta
 * sen seen_at päivittyy.
 */
function buildSourceHistory(
  existingHistory: unknown,
  input: ResolvePotentialProjectInput
): SourceHistoryEntry[] {
  const history: SourceHistoryEntry[] = Array.isArray(existingHistory)
    ? [...(existingHistory as SourceHistoryEntry[])]
    : []

  const md = (input.metadata ?? {}) as Record<string, any>

  const entry: SourceHistoryEntry = {
    source_name: input.sourceName ?? md.source_name ?? null,
    source_document_id: md.source_document_id ?? null,
    document_url: md.documents_url ?? md.source_url ?? null,
    notice_type: md.notice_type ?? null,
    main_type: md.main_type ?? null,
    date_published: md.date_published ?? null,
    is_contract_award: md.is_contract_award === true,
    winners: Array.isArray(md.winners) && md.winners.length > 0 ? md.winners : null,
    seen_at: new Date().toISOString(),
  }

  const existingIndex = entry.source_document_id
    ? history.findIndex(
        (h) => h.source_document_id === entry.source_document_id
      )
    : -1

  if (existingIndex >= 0) {
    history[existingIndex] = { ...history[existingIndex], ...entry }
  } else {
    history.push(entry)
  }

  return history
}

export async function resolvePotentialProject(
  input: ResolvePotentialProjectInput
) {
  const title = normalizeValue(input.title)
  const municipality = normalizeValue(input.municipality)
  const address = normalizeValue(input.address)
  const propertyId = normalizeValue(input.propertyId)
  const permitNumber = normalizeValue(input.permitNumber)

  /*
   * Vanhat uutiset/tiedotteet: jos lähdetekstissä mainitaan jo mennyt
   * valmistumisaika (esim. "Perusparannus valmistuu arviolta kesäkuussa
   * 2025"), hanke on käytännössä valmistunut eikä ole tuore liidi. Poimitaan
   * arvioitu valmistumispäivä estimated_completion-kenttään (auto-complete-
   * cron hyödyntää sitä hyväksytyille hankkeille) ja jos päivä on jo mennyt,
   * lasketaan kandidaatti "ignore"-tasolle, jotta se ei täytä tuoreiden
   * liidien jonoa. Detektio on konservatiivinen (haku vain "valmis"-sanan
   * lähellä), joten hankkeet ilman selkeää mennyttä valmistumista pysyvät
   * ennallaan. Tämä on keskitetty tänne, joten se koskee kaikkia lähteitä.
   */
  const md = (input.metadata ?? {}) as Record<string, any>
  const completionText = [input.title, md.description, md.operation]
    .filter(Boolean)
    .join(" ")
  const inferredCompletion = inferCompletionDateFromText(completionText)
  const staleCompleted = !!inferredCompletion && isPastDate(inferredCompletion)

  /*
   * Kaavan ajantasaistaminen (vanhan asemakaavan päivitys, ei uudisrakentamista)
   * ei ole rakennushanke — täsmätään lähteen nimeen/operaatioon, ei koko
   * kuvaukseen (kaavan nimi kertoo tarkoituksen luotettavasti).
   */
  const nonConstructionZoning =
    isNonConstructionZoning(input.title) ||
    isNonConstructionZoning(md.operation) ||
    hasNonConstructionZoningDisclaimer(md.description)

  /*
   * Hankkeen euromääräinen arvo. Keskitetty tänne samasta syystä kuin
   * valmistumisaika yllä: se koskee kaikkia lähteitä, eikä jokaisen
   * resolverin pidä muistaa poimia sitä erikseen.
   *
   * Aiemmin `extractCostFromText` oli olemassa mutta sitä kutsuttiin VAIN
   * käsin ajettavasta backfill-skriptistä, joten uudet hankkeet eivät saaneet
   * kustannusta lainkaan — kenttä täyttyi vain silloin kun joku muisti ajaa
   * skriptin. Hilman `contract_value` puolestaan poimittiin jo faktana mutta
   * jäi metadataan: mitattu 15.8.2026, 105 hanketta joilla oli sopimusarvo,
   * ja niistä 104:llä `estimated_cost` oli tyhjä.
   */
  const costText = [md.description, md.operation, input.title]
    .filter(Boolean)
    .join(" ")

  /*
   * POIMITTU PAIVA EI SAA HAVITA LAHTEEN TYHJAAN.
   *
   * Kentta kirjoitettiin metadatan ALKUUN, jonka jalkeen
   * `...input.metadata` levitettiin paalle - ja koska lahteet asettavat
   * `estimated_completion: null` rakenteisena kenttana, tyhja voitti
   * poimitun paivan joka kerta. Mitattu tapaus 1.9.2026: Kivenlahden
   * pukutilat, jonka kuvauksessa lukee "Rakennuksen on tarkoitus
   * valmistua marras-joulukuussa 2028" ja jonka poimija lukee oikein
   * (2028-12-31) - mutta kannassa kentta oli null.
   *
   * Nyt paiva kirjoitetaan levitysten JALKEEN ja vain jos kentta on
   * aidosti tyhja. Lahteen tai aiemman ajon oma arvo voittaa yha.
   */
  function completionField(
    existingMetadata?: Record<string, any> | null
  ): Record<string, unknown> {
    if (!inferredCompletion) return {}
    const nyt = String(
      existingMetadata?.estimated_completion ?? md.estimated_completion ?? ""
    ).trim()
    return nyt ? {} : { estimated_completion: inferredCompletion }
  }

  /*
   * HANKKEEN PINTA-ALA. Sama kaava kuin kustannuksessa: kenttä oli
   * olemassa muttei kirjoittajaa, ja tieto oli kuvauksessa. Mitattu
   * 5.9.2026: näkyvistä 5 871 hankkeesta 601 mainitsi alan ja 138:lla
   * kenttä oli täytetty. Poimintasäännöt ja niiden esteet ovat
   * `extractFloorAreaFromText`issa - maa-alaa, rakennusoikeutta tai
   * asunnon kokoa ei poimita.
   */
  function alaMetadata(
    existingMetadata?: Record<string, any> | null
  ): Record<string, unknown> {
    const nyt = String(existingMetadata?.floor_area ?? md.floor_area ?? "").trim()
    if (nyt) return {}

    /*
     * LOMAKEKENTTA VOITTAA TEKSTIN. Lupapisteen kuulutus-PDF:sta on jo
     * luettu "Kerrosala" ja "Kokonaisala" omina kenttinaan
     * (`lupapisteResolver` -> `floor_area_text`), ja nimetty kentta on
     * vahvempi todiste kuin lauseesta paateltu luku. Mitattu 6.9.2026:
     * tieto oli haettu, jasennetty ja tallennettu - muttei kannettu
     * eteenpain, joten 20 nakyvalla hankkeella oli teksti muttei kentta.
     *
     * "Pinta-ala" (`site_area_text`) EI kelpaa: lupapaatoksessa se on
     * tontin ala, ei rakennuksen. Sama ansa kuin tekstipoimijassa.
     */
    const kentasta = parseAlaTeksti(md.floor_area_text) ?? parseAlaTeksti(md.total_area_text)
    if (kentasta) return { floor_area: kentasta }

    const ala = extractFloorAreaFromText(costText)
    return ala ? { floor_area: ala } : {}
  }

  function costMetadata(
    existingMetadata?: Record<string, any> | null
  ): Record<string, unknown> {
    const resolved = resolveProjectCost({
      contractValue: md.contract_value,
      text: costText,
      existingCost: existingMetadata?.estimated_cost,
      existingSource: existingMetadata?.cost_source,
    })

    if (!resolved) return {}

    return {
      estimated_cost: resolved.estimated_cost,
      cost_source: resolved.cost_source,
    }
  }

  /*
   * LAHDE ITSE SANOO ETTA KOHDE ON VALMIS.
   *
   * Aiempi saanto vaati valmistumisPAIVAN tekstista, eika se laukea
   * referenssiportfolioissa: niissa vaihe on rakenteinen kenttä eika
   * kuvauksessa lue paivamaaraa. Mitattu 23.8.2026 - jonossa oli 19
   * valmistunutta hanketta (Iso Omena, Olkiluodon kapselointilaitos,
   * Sokos Hotel Turun Seurahuone) joista jokaisella recommended_action
   * oli tyhja, eli suodatus ei ollut kaynyt kertaakaan.
   *
   * Valmis rakennus ei ole liidi. Ihmisen ei kuulu tehda siita
   * hylkayspaatosta yksi kerrallaan.
   */
  const sourceSaysCompleted =
    String(md.phase_hint ?? "").trim().toLowerCase() === PHASE_LABELS.completed.toLowerCase()

  let completionMetadata: Record<string, unknown> = {}
  if (sourceSaysCompleted) {
    completionMetadata = {
      recommended_action: "ignore",
      auto_ignored_reason: "lahde_ilmoittaa_valmistuneeksi",
    }
  } else if (staleCompleted) {
    completionMetadata = {
      recommended_action: "ignore",
      auto_ignored_reason: `valmistunut_menneisyydessa:${inferredCompletion}`,
    }
  } else if (nonConstructionZoning) {
    completionMetadata = {
      recommended_action: "ignore",
      auto_ignored_reason: "kaavan_ajantasaistaminen",
    }
  }

  /*
   * Auto-ohitetut ehdokkaat (CQE:n recommended_action="ignore" tai yllä olevat
   * keskitetyt ignore-säännöt) viimeistellään suoraan terminaaliseen "ignored"-
   * tilaan sen sijaan että jäisivät "new":ksi. Muuten ne jäivät ikuisesti
   * "new"-jonoon — piilotettuna katselmoinnista mutta TicDailySummaryn laskurissa
   * pysyvästi kasvaen ("suodatettiin pois automaattisesti" ei koskaan tyhjentynyt).
   */
  const ruleRecommendedAction =
    (completionMetadata as Record<string, any>).recommended_action ??
    (input.metadata as Record<string, any>)?.recommended_action ??
    null

  /*
   * Harmaa alue: sääntö ei sanonut mitään, joten kysytään mallilta pääseekö
   * ehdokas katselmointijonoon. Portti ajetaan vasta alempana, luontihaarassa:
   * jo olemassa olevalle ehdokkaalle päätös on tehty kertaalleen eikä samaa
   * otsikkoa kannata kysyä mallilta uudelleen jokaisella lähdesignaalilla.
   */
  const effectiveRecommendedAction = ruleRecommendedAction
  const autoIgnored = effectiveRecommendedAction === "ignore"

  let existing = null
  let matchedExistingProjectId: string | null = null

  /*
   * Tarkka taso: tyypitetyt tunnisteet (esim. Lupapisteen lupanumero,
   * kiinteistötunnus, Hilman ilmoitusnumero mukaan lukien sen
   * parent_notice_id/linked_notices) ohittavat alla olevan vanhan
   * kaskadin, joka pysyy muuttumattomana varajärjestelmänä.
   */
  if (input.identifiers?.length) {
    const found = await findByIdentifiers(input.identifiers, supabaseAdmin)

    if (found?.potentialProjectId) {
      const { data, error } = await supabaseAdmin
        .from("potential_projects")
        .select("*")
        .eq("id", found.potentialProjectId)
        .maybeSingle()

      if (error) throw error
      existing = data
    }

    if (found?.projectId) {
      matchedExistingProjectId = found.projectId
    }
  }

  if (!existing && permitNumber) {
    const { data, error } = await supabaseAdmin
      .from("potential_projects")
      .select("*")
      .eq("permit_number", permitNumber)
      .maybeSingle()

    if (error) throw error
    existing = data
  }

  if (!existing && propertyId) {
    const { data, error } = await supabaseAdmin
      .from("potential_projects")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle()

    if (error) throw error
    existing = data
  }

  if (!existing && address && municipality) {
    const { data, error } = await supabaseAdmin
      .from("potential_projects")
      .select("*")
      .eq("address", address)
      .eq("municipality", municipality)
      .maybeSingle()

    if (error) throw error
    existing = data
  }

  if (existing) {
    const sourceHistory = buildSourceHistory(
      existing.metadata?.source_history,
      input
    )

    const { data: updated, error } = await supabaseAdmin
      .from("potential_projects")
      .update({
        // Viimeistele auto-ohitetut myös päivityksessä: jos ehdokas on yhä
        // "new" mutta efektiivinen suositus on ignore (uusi tai aiempi tieto),
        // siirretään terminaaliin "ignored"-tilaan. Hyväksyttyjä/hylättyjä ei
        // koskettaa.
        ...(existing.status === "new" &&
        (effectiveRecommendedAction === "ignore" ||
          (existing.metadata as Record<string, any>)?.recommended_action ===
            "ignore")
          ? { status: "ignored" }
          : {}),
        title: existing.title ?? title,
        municipality: existing.municipality ?? municipality,
        address: existing.address ?? address,
        property_id: existing.property_id ?? propertyId,
        permit_number: existing.permit_number ?? permitNumber,
        source_count: Number(existing.source_count ?? 0) + 1,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...(existing.metadata ?? {}),
          ...(input.metadata ?? {}),
          ...completionField(existing.metadata),
          ...completionMetadata,
          ...costMetadata(existing.metadata),
          ...alaMetadata(existing.metadata),
          source_history: sourceHistory,
          lastSourceName: input.sourceName ?? null,
          matched_existing_project_id:
            existing.metadata?.matched_existing_project_id ??
            matchedExistingProjectId,
        },
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) throw error

    await linkIdentifiers(input.identifiers, updated.id)

    /*
     * Jo hyväksytty ehdokas ei enää palaa hyväksyntäjonoon, joten uusi
     * tieto (esim. Hilman jatkoilmoitus samasta kilpailutuksesta) ei
     * muuten koskaan päätyisi julkiseen hankkeeseen asti.
     */
    const approvedProjectId = existing.metadata?.approved_project_id
    if (existing.status === "approved" && approvedProjectId) {
      await syncApprovedProject({
        supabase: supabaseAdmin,
        projectId: approvedProjectId,
        newMetadata: { ...(input.metadata ?? {}), source_history: sourceHistory },
        sourceName: input.sourceName,
      })
    }

    return {
      action: "updated_existing",
      potentialProject: updated,
    }
  }

  const confidence =
    permitNumber || propertyId ? 90 : address && municipality ? 70 : 40

  /*
   * Harmaan alueen LLM-portti: ajetaan vain uusille ehdokkaille ja vain kun
   * sääntö ei sanonut mitään. Portti voi suodattaa jonon ulkopuolelle, ei
   * koskaan hyväksyä julkiseksi. Fail-open: virheessä ehdokas menee jonoon.
   */
  const relevanceGate = await gateCandidateRelevance({
    title,
    description: md.description ?? md.operation ?? null,
    sourceName: input.sourceName ?? null,
    ruleRecommendedAction,
  })

  /*
   * Kohdetyyppi mallilta vain kun sääntö ei osannut. Sama kaava kuin
   * relevanssiportissa: uusi ehdokas, harmaa alue, fail-open.
   */
  const buildingType = await resolveBuildingType({
    title,
    description: md.description ?? md.operation ?? null,
    ruleBuildingType: md.building_type,
  })

  const { data: created, error } = await supabaseAdmin
    .from("potential_projects")
    .insert({
      title,
      municipality,
      address,
      property_id: propertyId,
      permit_number: permitNumber,
      confidence,
      source_count: 1,
      evidence_count: 0,
      status: autoIgnored || relevanceGate.ignored ? "ignored" : "new",
      metadata: {
        ...(input.metadata ?? {}),
        ...completionField(null),
        ...completionMetadata,
        ...costMetadata(null),
        ...alaMetadata(null),
        ...relevanceGate.metadata,
        ...buildingType.metadata,
        source_history: buildSourceHistory(null, input),
        firstSourceName: input.sourceName ?? null,
        matched_existing_project_id: matchedExistingProjectId,
      },
    })
    .select()
    .single()

  if (error) throw error

  await linkIdentifiers(input.identifiers, created.id)

  return {
    action: "created_new",
    potentialProject: created,
  }
}

async function linkIdentifiers(
  identifiers: ResolvePotentialProjectInput["identifiers"],
  potentialProjectId: string
) {
  for (const identifier of identifiers ?? []) {
    await linkIdentifier({
      type: identifier.type,
      value: identifier.value,
      potentialProjectId,
      supabase: supabaseAdmin,
    })
  }
}