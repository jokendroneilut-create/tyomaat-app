import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/*
 * Sallii hyväksyntäjonossa olevan ehdotuksen tietojen korjaamisen käsin
 * ennen hyväksymistä, kun lähde on poiminut jonkin kentän väärin (esim.
 * otsikkoon jäänyt rakennusvaiheen kuvaus, väärä kunta/maakunta pääteltynä
 * tekstistä). Hyväksymisreitti lukee nämä samat kentät (title, municipality,
 * address + metadata.operation/region/building_type/developer/phase_hint),
 * joten korjaus näkyy suoraan seuraavassa hyväksynnässä ilman että
 * approve-reittiä tarvitsee muuttaa.
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const potentialProjectId = body.potentialProjectId

  if (!potentialProjectId) {
    return NextResponse.json(
      { ok: false, error: "Missing potentialProjectId" },
      { status: 400 }
    )
  }

  const { data: potentialProject, error: fetchError } = await supabaseAdmin
    .from("potential_projects")
    .select("*")
    .eq("id", potentialProjectId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
  }

  if (!potentialProject) {
    return NextResponse.json(
      { ok: false, error: "Potential project not found" },
      { status: 404 }
    )
  }

  const title = cleanString(body.title)
  const municipality = cleanString(body.municipality)
  const address = cleanString(body.address)
  const region = cleanString(body.region)
  const buildingType = cleanString(body.buildingType)
  const developer = cleanString(body.developer)
  const phaseHint = cleanString(body.phaseHint)

  const existingMetadata = potentialProject.metadata ?? {}

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("potential_projects")
    .update({
      title: title ?? potentialProject.title,
      municipality,
      address,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        operation: title ?? existingMetadata.operation,
        region,
        building_type: buildingType,
        developer,
        phase_hint: phaseHint,
        manually_edited_at: new Date().toISOString(),
      },
    })
    .eq("id", potentialProjectId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, potentialProject: updated })
}
