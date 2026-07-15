import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type IdentifierType =
  | "property_id"
  | "hilma_notice_number"
  | "lupapiste_permit_number"
  | "espoo_permit_number"
  | "vantaa_kaava_tunnus"
  | "helsinki_kaava_tunnus"
  | "tampere_kaava_tunnus"
  | "turku_kaava_tunnus"
  | "kreate_project_id"
  | "vayla_project_id"
  | "senaatti_project_id"
  | "kuopio_kaava_tunnus"
  | "lahti_kaava_tunnus"
  | "pori_kaava_tunnus"
  | "oulu_kaava_tunnus"
  | "jyvaskyla_kaava_id"
  | "hameenlinna_kaava_tunnus"
  | "joensuu_kaava_id"
  | "vaasa_kaava_tunnus"
  | "kouvola_kaava_tunnus"
  | "lappeenranta_kaava_id"

export const IDENTIFIER_TYPES: IdentifierType[] = [
  "property_id",
  "hilma_notice_number",
  "lupapiste_permit_number",
  "espoo_permit_number",
  "vantaa_kaava_tunnus",
  "helsinki_kaava_tunnus",
  "tampere_kaava_tunnus",
  "turku_kaava_tunnus",
  "kreate_project_id",
  "vayla_project_id",
  "senaatti_project_id",
  "kuopio_kaava_tunnus",
  "lahti_kaava_tunnus",
  "pori_kaava_tunnus",
  "oulu_kaava_tunnus",
  "jyvaskyla_kaava_id",
  "hameenlinna_kaava_tunnus",
  "joensuu_kaava_id",
  "vaasa_kaava_tunnus",
  "kouvola_kaava_tunnus",
  "lappeenranta_kaava_id",
]

/*
 * Yhteinen normalisointi tunnuksille (lupanumerot, kiinteistötunnukset) ja
 * osoitteille/nimille. Aiemmin nämä olivat kahtena erillisenä kopiona
 * lib/agent/projectMatcher.ts:ssä ("normalizeIdentifier"/"norm") — nyt
 * projectMatcher.ts tuo ne tästä samasta paikasta, jotta ne eivät ajan
 * myötä eriydy toisistaan.
 */
export function normalizeIdentifierValue(
  value: string | null | undefined
): string | null {
  const normalized = normalizeAddress(value)
  if (!normalized) return null
  return normalized.replace(/\s+/g, "")
}

export function normalizeAddress(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized.length > 0 ? normalized : null
}

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function linkIdentifier(input: {
  type: IdentifierType
  value: string | null | undefined
  projectId?: string | null
  potentialProjectId?: string | null
  sourceName?: string | null
  sourceDocumentId?: string | null
  confidence?: number | null
  metadata?: Record<string, unknown>
  supabase?: SupabaseClient
}): Promise<{ row: any; wasNew: boolean } | null> {
  const normalized = normalizeIdentifierValue(input.value)
  if (!normalized) return null

  if (!input.projectId && !input.potentialProjectId) return null

  const supabase = input.supabase ?? getSupabaseAdmin()

  const { data: existing, error: fetchError } = await supabase
    .from("project_identifiers")
    .select("*")
    .eq("identifier_type", input.type)
    .eq("identifier_value_normalized", normalized)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (!existing) {
    const { data: created, error: insertError } = await supabase
      .from("project_identifiers")
      .insert({
        identifier_type: input.type,
        identifier_value: input.value,
        identifier_value_normalized: normalized,
        project_id: input.projectId ?? null,
        potential_project_id: input.potentialProjectId ?? null,
        source_name: input.sourceName ?? null,
        source_document_id: input.sourceDocumentId ?? null,
        confidence: input.confidence ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single()

    if (insertError) throw insertError

    return { row: created, wasNew: true }
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_identifiers")
    .update({
      project_id: existing.project_id ?? input.projectId ?? null,
      potential_project_id:
        existing.potential_project_id ?? input.potentialProjectId ?? null,
      source_name: existing.source_name ?? input.sourceName ?? null,
      confidence: Math.max(existing.confidence ?? 0, input.confidence ?? 0) || null,
      metadata: { ...(existing.metadata ?? {}), ...(input.metadata ?? {}) },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single()

  if (updateError) throw updateError

  return { row: updated, wasNew: false }
}

export async function findByIdentifiers(
  identifiers: { type: IdentifierType; value: string | null | undefined }[],
  supabaseClient?: SupabaseClient
): Promise<{ projectId: string | null; potentialProjectId: string | null; rows: any[] } | null> {
  const supabase = supabaseClient ?? getSupabaseAdmin()

  const pairs = identifiers
    .map((id) => ({ type: id.type, normalized: normalizeIdentifierValue(id.value) }))
    .filter((id): id is { type: IdentifierType; normalized: string } => !!id.normalized)

  if (pairs.length === 0) return null

  const rows: any[] = []

  for (const pair of pairs) {
    const { data, error } = await supabase
      .from("project_identifiers")
      .select("*")
      .eq("identifier_type", pair.type)
      .eq("identifier_value_normalized", pair.normalized)

    if (error) throw error
    if (data) rows.push(...data)
  }

  if (rows.length === 0) return null

  const withProject = rows.find((row) => row.project_id)
  const withPotential = rows.find((row) => row.potential_project_id)

  return {
    projectId: withProject?.project_id ?? null,
    potentialProjectId: withPotential?.potential_project_id ?? null,
    rows,
  }
}
