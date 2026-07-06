import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.json()
  const potentialProjectId = body.potentialProjectId
  const reason = body.reason ?? null

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
    .maybeSingle()

  if (potentialError) {
    return NextResponse.json(
      { ok: false, error: potentialError.message },
      { status: 500 }
    )
  }

  if (!potentialProject) {
    return NextResponse.json(
      { ok: false, error: "Potential project not found" },
      { status: 404 }
    )
  }

  const metadata = potentialProject.metadata ?? {}

  const { error: updateError } = await supabaseAdmin
    .from("potential_projects")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        rejected_at: new Date().toISOString(),
        rejected_reason: reason,
      },
    })
    .eq("id", potentialProjectId)

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    action: "rejected",
    potentialProjectId,
  })
}