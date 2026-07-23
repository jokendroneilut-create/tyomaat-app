import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { findProjectMatchDetailed } from "@/lib/agent/projectMatcher"
import { inferPhaseFromText } from "@/lib/projects/inferPhaseFromText"
import { inferCompletionDateFromText, isPastDate } from "@/lib/projects/inferCompletionDateFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { stripCompanyPrefixFromHeadline } from "@/lib/agent/stripCompanyPrefix"

/*
 * Tämän putken lähde (yritysten lehdistötiedotteet) ei anna luotettavaa
 * tietoa lupanumeron alkuperästä, joten tyyppi päätellään parhaan
 * yrityksen mukaan tunnetuista muodoista. Jos mikään ei täsmää, lupa­
 * numeroa ei tyypitetä tarkkaan tunnistetauluun — sumea matcheri
 * (findProjectMatchDetailed) hoitaa täsmäytyksen silloin edelleen.
 */
function guessPermitIdentifierType(value: string | null): IdentifierType | null {
  if (!value) return null
  if (/^LP-\d+-\d{4}-\d+$/i.test(value)) return "lupapiste_permit_number"
  if (/^\d{4}-\d+$/.test(value)) return "hilma_notice_number"
  return null
}

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    if (!body.name || body.name.trim().length < 5) {
  return NextResponse.json({ status: "invalid_name" })
}

if (/^\d+$/.test(body.name.trim())) {
  return NextResponse.json({ status: "invalid_name" })
}
if (body.name.trim().toLowerCase() === "lue lisää") {
  return NextResponse.json({ status: "invalid_name" })
}

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const candidate = {
      name: body.name || null,
      city: body.city || null,
      region: body.region || null,
      location: body.location || null,
      permitNumber: body.permit_number ?? body.metadata?.permit_number ?? null,
      propertyId: body.property_id ?? body.metadata?.property_id ?? null,
      developer: body.developer ?? body.metadata?.developer ?? null,
      buildingType:
        body.property_type ??
        body.building_type ??
        body.metadata?.building_type ??
        null,
      estimatedCompletion:
        body.estimated_completion ?? body.metadata?.estimated_completion ?? null,
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

    const { data: projects } = await supabase
      .from("projects")
      .select(
        "id,name,city,region,location,phase,completed_at,status,developer,property_type,estimated_completion,metadata"
      )

    let detailedMatch = findProjectMatchDetailed(
  projects || [],
  candidate
)

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
  detailedMatch && detailedMatch.confidence >= 70
    ? detailedMatch.project
    : null

    if (match) {
      const matchedProjectId = match.id
      const matchedNewPhase = body.phase || match.phase

      await supabase
        .from("projects")
        .update({
          last_verified_at: new Date().toISOString(),
          city: body.city || match.city || null,
          region: body.region || match.region || null,
          location: body.location || match.location || null,
          phase: body.phase || match.phase || undefined,
          developer: body.developer || match.developer || null,
          property_type:
            body.property_type ||
            body.building_type ||
            match.property_type ||
            null,
          estimated_completion:
            body.estimated_completion ||
            body.metadata?.estimated_completion ||
            match.estimated_completion ||
            null,
          needs_review: body.completed ? true : false,
          source_confidence: body.confidence ?? null,
          status: body.completed ? "completed" : match.status ?? "active",
          completed_at: body.completed
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
    project_id: matchedProjectId, // tai inserted.id toisessa haarassa
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

      return NextResponse.json({
        status: "matched",
        project_id: matchedProjectId,
      })
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

        return NextResponse.json({
          status: "duplicate_source",
          reason: "source_url already imported",
        })
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

  if (body.completed || isStaleCompletion) {
      await supabase.from("project_import_events").insert({
        source_name: body.source_name || "agent",
        source_url: body.source_url || null,
        normalized_payload: body,
        match_status: "completed_source",
        matched_project_id: null,
        action_taken: "skipped",
        reason: isStaleCompletion && !body.completed
          ? `estimated completion (${inferredCompletionDate}) already passed`
          : "completed project not inserted as new",
        match_confidence: detailedMatch?.confidence ?? null,
        match_reasons: detailedMatch?.reasons ?? [],
      })

      return NextResponse.json({
        status: "skipped_completed",
        reason: isStaleCompletion && !body.completed
          ? `estimated completion (${inferredCompletionDate}) already passed`
          : "completed project not inserted as new",
      })
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
    const cleanedTitle = stripCompanyPrefixFromHeadline(body.name)

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
        developer: candidate.developer,
        building_type: candidate.buildingType,
        region: body.region || null,
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
      match_status: result.action === "updated_existing" ? "matched_candidate" : "new",
      matched_project_id: null,
      action_taken: "queued_for_review",
      reason: null,
      match_confidence: detailedMatch?.confidence ?? null,
      match_reasons: detailedMatch?.reasons ?? [],
    })

    return NextResponse.json({
      status: "queued_for_review",
      potential_project_id: result.potentialProject.id,
      action: result.action,
    })
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      {
        error: err.message,
      },
      { status: 500 }
    )
  }
}