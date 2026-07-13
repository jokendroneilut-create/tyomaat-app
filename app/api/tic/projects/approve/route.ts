import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { geocodeProjectLocation } from "@/lib/geo/geocode"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const potentialProjectId = body.potentialProjectId

    if (!potentialProjectId) {
      return NextResponse.json(
        { ok: false, error: "Missing potentialProjectId" },
        { status: 400 }
      )
    }

    const { data: potentialProject, error: potentialError } =
      await supabaseAdmin
        .from("potential_projects")
        .select("*")
        .eq("id", potentialProjectId)
        .single()

    if (potentialError || !potentialProject) {
      return NextResponse.json(
        { ok: false, error: "Potential project not found" },
        { status: 404 }
      )
    }

    const metadata = potentialProject.metadata ?? {}

    const { data: sourceDocument, error: sourceDocumentError } =
      metadata.source_document_id
        ? await supabaseAdmin
            .from("source_documents")
            .select("document_url, source_name")
            .eq("id", metadata.source_document_id)
            .maybeSingle()
        : { data: null, error: null }

    if (sourceDocumentError) {
      throw sourceDocumentError
    }

    const sourceName =
      sourceDocument?.source_name ??
      metadata.source_name ??
      metadata.firstSourceName ??
      metadata.lastSourceName ??
      metadata.source ??
      null

    const isHilma =
      normalize(sourceName) === "hilma" ||
      normalize(metadata.resolver) === "hilmaresolver"

    /*
     * Hilman potentialProject.address on tällä hetkellä yleensä
     * hankintayksikön toimisto-osoite, ei rakennuskohteen osoite.
     *
     * Sitä ei siksi saa käyttää karttasijaintina.
     */
    const buyerAddress = isHilma
      ? potentialProject.address ?? null
      : metadata.buyer_address ?? null

    const projectAddress = isHilma
      ? metadata.project_address ??
        metadata.site_address ??
        metadata.worksite_address ??
        null
      : potentialProject.address ?? null

    const city = isHilma
      ? metadata.project_municipality ??
        metadata.site_municipality ??
        potentialProject.municipality ??
        null
      : potentialProject.municipality ?? null

    const region =
      metadata.region ??
      getRegionForMunicipality(city)

    const location = buildProjectLocation({
      address: projectAddress,
      city,
    })

    /*
     * Lupapiste antaa tarkat koordinaatit valmiiksi (ETRS-TM35FIN, muunnettu
     * WGS84:ksi jo tunnistusvaiheessa) — käytetään niitä suoraan sen sijaan
     * että osoite geokoodattaisiin uudelleen Nominatimin kautta.
     */
    const lupapisteCoords = metadata.lupapiste_coordinates_wgs84

    const coords =
      lupapisteCoords?.lat != null && lupapisteCoords?.lon != null
        ? { lat: lupapisteCoords.lat, lon: lupapisteCoords.lon }
        : location || city || region
          ? await geocodeProjectLocation({
              location,
              city,
              region,
            })
          : {
              lat: null,
              lon: null,
            }

    const sourceUrl =
      sourceDocument?.document_url ??
      metadata.source_url ??
      null

    const documentsUrl =
      metadata.documents_url ??
      metadata.document_url ??
      null

    const deadline =
      metadata.deadline ??
      null

    const developer =
      metadata.developer ??
      null

    const phase =
  metadata.phase_hint ??
  (isHilma
    ? PHASE_LABELS.tender
    : PHASE_LABELS.planning)

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert({
        name: buildCustomerProjectName({
          potentialProject,
          isHilma,
          projectAddress,
        }),

        city,
        region,
        location,

        lat: coords.lat,
        lng: coords.lon,
        latitude: coords.lat,
        longitude: coords.lon,

        developer,

        property_type: metadata.building_type ?? null,
        phase,
        source_confidence: potentialProject.confidence,
        is_public: true,
        needs_review: false,
        status: "active",

        additional_info:
          metadata.description ??
          metadata.operation ??
          null,

        metadata: {
  /*
   * Säilytetään kaikki potentiaalisen hankkeen metadata.
   * Näin uusien agenttikenttien lisääminen ei vaadi aina
   * approve-reitin muuttamista.
   */
  ...metadata,

  /*
   * Alla olevat kentät kirjoitetaan tarkoituksella spreadin jälkeen,
   * jotta hyväksyntävaiheessa muodostetut canonical-arvot voittavat.
   */
  source: sourceName ?? metadata.source ?? "discovery_agent",
  source_name: sourceName,
  source_url: sourceUrl,
  documents_url: documentsUrl,

  potential_project_id: potentialProject.id,
  source_document_id: metadata.source_document_id ?? null,

  permit_number: potentialProject.permit_number,
  notice_number:
    metadata.notice_number ??
    potentialProject.permit_number ??
    null,
  notice_id: metadata.notice_id ?? null,

  deadline,
  date_published: metadata.date_published ?? null,
  procurement_type_code:
    metadata.procurement_type_code ?? null,

  developer,
  buyer_address: buyerAddress,
  project_address: projectAddress,

  operation: metadata.operation ?? null,
  description: metadata.description ?? null,
  district: metadata.district ?? null,

  property_id: potentialProject.property_id,

  construction_type:
    metadata.construction_type ?? null,
  building_type:
    metadata.building_type ?? null,
  business_value:
    metadata.business_value ?? null,
  recommended_action:
    metadata.recommended_action ?? null,
  classification_confidence:
    metadata.classification_confidence ?? null,
  classification_reasons:
    metadata.classification_reasons ?? [],

  resolver: metadata.resolver ?? null,

  approved_at: new Date().toISOString(),
  approved_from: "tic",
},
      })
      .select()
      .single()

    if (projectError) {
      return NextResponse.json(
        { ok: false, error: projectError.message },
        { status: 500 }
      )
    }

    await recordPhaseChange({
      supabase: supabaseAdmin,
      projectId: project.id,
      newPhase: project.phase,
      previousPhase: null,
      source: "tic_approve",
      sourceName: sourceName ?? "tic",
    })

    await supabaseAdmin.from("project_imports").insert({
      potential_project_id: potentialProject.id,
      project_id: project.id,
      action: "create_project",
      source_document_id:
        metadata.source_document_id ?? null,
      source_name: sourceName,

      changes: {
        created_project: {
          name: project.name,
          city: project.city,
          region: project.region,
          location: project.location,
          property_type: project.property_type,
          phase: project.phase,
        },
      },

      metadata: {
        approved_from: "tic",
        source_url: sourceUrl,
        documents_url: documentsUrl,
        deadline,
        permit_number: potentialProject.permit_number,
        property_id: potentialProject.property_id,
        construction_type:
          metadata.construction_type ?? null,
        building_type:
          metadata.building_type ?? null,
        region,
      },
    })

    await supabaseAdmin
      .from("potential_projects")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          approved_at: new Date().toISOString(),
          approved_project_id: project.id,
          approved_region: region,
          approved_source_url: sourceUrl,
          approved_documents_url: documentsUrl,
        },
      })
      .eq("id", potentialProject.id)

    return NextResponse.json({
      ok: true,
      action: "created_project",
      projectId: project.id,
      potentialProjectId: potentialProject.id,
      geocoded: Boolean(coords.lat && coords.lon),
      sourceUrl,
      documentsUrl,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Unknown error",
      },
      { status: 500 }
    )
  }
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function buildCustomerProjectName({
  potentialProject,
  isHilma,
  projectAddress,
}: {
  potentialProject: any
  isHilma: boolean
  projectAddress: string | null
}) {
  const metadata = potentialProject.metadata ?? {}
  const operation = metadata.operation

  /*
   * Hilma-hankkeen nimeen ei lisätä hankintayksikön
   * toimisto-osoitetta.
   */
  if (isHilma) {
    return (
      operation ??
      potentialProject.title ??
      "Hankintailmoitus"
    )
  }

  if (operation && projectAddress) {
    return `${operation}, ${projectAddress}`
  }

  if (operation) return operation

  if (projectAddress) {
    return `Rakennushanke, ${projectAddress}`
  }

  return potentialProject.title ?? "Rakennushanke"
}

function buildProjectLocation({
  address,
  city,
}: {
  address: string | null
  city: string | null
}) {
  if (
    address &&
    city &&
    !normalize(address).includes(normalize(city))
  ) {
    return `${address}, ${city}`
  }

  return address ?? null
}

function getRegionForMunicipality(
  municipality: string | null
) {
  if (!municipality) return null

  const normalized = normalize(municipality)

  const uusimaa = [
    "espoo",
    "helsinki",
    "vantaa",
    "kauniainen",
    "kirkkonummi",
    "vihti",
    "nurmijärvi",
    "tuusula",
    "kerava",
    "järvenpää",
    "sipoo",
    "porvoo",
    "lohja",
    "raasepori",
    "hanko",
    "inkoo",
    "siuntio",
    "pornainen",
    "mäntsälä",
    "hyvinkää",
    "karkkila",
    "lapinjärvi",
    "loviisa",
    "myrskylä",
    "pukkila",
    "askola",
  ]

  if (uusimaa.includes(normalized)) {
    return "Uusimaa"
  }

  return null
}