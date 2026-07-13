import { createClient } from "@supabase/supabase-js"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"

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