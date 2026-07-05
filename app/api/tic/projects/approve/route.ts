import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { geocodeProjectLocation } from "@/lib/geo/geocode"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.json()
  const potentialProjectId = body.potentialProjectId

  if (!potentialProjectId) {
    return NextResponse.json(
      { ok: false, error: "Missing potentialProjectId" },
      { status: 400 }
    )
  }

  const { data: potentialProject, error: potentialError } = await supabaseAdmin
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
const region = getRegionForMunicipality(potentialProject.municipality)
const location = buildProjectLocation(potentialProject)

const coords = await geocodeProjectLocation({
  location,
  city: potentialProject.municipality,
  region,
})

  const { data: project, error: projectError } = await supabaseAdmin
  .from("projects")
  .insert({
    name: buildCustomerProjectName(potentialProject),
    city: potentialProject.municipality,
    region,
    location,

    lat: coords.lat,
    lng: coords.lon,
    latitude: coords.lat,
    longitude: coords.lon,

    property_type: metadata.building_type ?? null,
    phase: "Suunnittelussa",
    source_confidence: potentialProject.confidence,
    is_public: true,
    needs_review: false,
    status: "active",
    additional_info: metadata.operation ?? null,

    metadata: {
      source: "discovery_agent",
      potential_project_id: potentialProject.id,
      permit_number: potentialProject.permit_number,
      property_id: potentialProject.property_id,
      source_document_id: metadata.source_document_id ?? null,
      operation: metadata.operation ?? null,
      district: metadata.district ?? null,
      construction_type: metadata.construction_type ?? null,
      building_type: metadata.building_type ?? null,
      business_value: metadata.business_value ?? null,
      recommended_action: metadata.recommended_action ?? null,
      classification_reasons: metadata.classification_reasons ?? [],
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

  await supabaseAdmin.from("project_imports").insert({
    potential_project_id: potentialProject.id,
    project_id: project.id,
    action: "create_project",
    source_document_id: metadata.source_document_id ?? null,
    source_name: metadata.firstSourceName ?? metadata.lastSourceName ?? null,
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
      permit_number: potentialProject.permit_number,
      property_id: potentialProject.property_id,
      construction_type: metadata.construction_type ?? null,
      building_type: metadata.building_type ?? null,
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
      },
    })
    .eq("id", potentialProject.id)

  return NextResponse.json({
    ok: true,
    action: "created_project",
    projectId: project.id,
    potentialProjectId: potentialProject.id,
  })
}

function buildCustomerProjectName(potentialProject: any) {
  const metadata = potentialProject.metadata ?? {}
  const operation = metadata.operation
  const address = potentialProject.address

  if (operation && address) {
    return `${operation}, ${address}`
  }

  if (operation) return operation
  if (address) return `Rakennushanke, ${address}`

  return potentialProject.title ?? "Rakennushanke"
}

function getRegionForMunicipality(municipality: string | null) {
  if (!municipality) return null

  const normalized = municipality.trim().toLowerCase()

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

  if (uusimaa.includes(normalized)) return "Uusimaa"

  return null
}

function buildProjectLocation(potentialProject: any) {
  const address = potentialProject.address
  const city = potentialProject.municipality

  if (address && city && !address.toLowerCase().includes(city.toLowerCase())) {
    return `${address}, ${city}`
  }

  return address ?? null
}