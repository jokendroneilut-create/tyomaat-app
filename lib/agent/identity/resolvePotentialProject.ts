import { createClient } from "@supabase/supabase-js"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"
import { syncApprovedProject } from "@/lib/projects/syncApprovedProject"

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
      status: "new",
      metadata: {
        ...(input.metadata ?? {}),
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