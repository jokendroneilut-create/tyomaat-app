import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"

export const runtime = "nodejs"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "missing auth token" },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const token = authHeader.replace("Bearer ", "").trim()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      )
    }

    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)

    if (!admins.includes((user.email || "").toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      )
    }

    const body = await req.json()

    if (!body.projectId) {
      return NextResponse.json(
        { ok: false, error: "missing projectId" },
        { status: 400 }
      )
    }

    await recordPhaseChange({
      supabase,
      projectId: body.projectId,
      newPhase: body.newPhase,
      previousPhase: body.previousPhase,
      source: "dashboard_admin",
      sourceName: user.email,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("RECORD PHASE CHANGE ERROR:", err)

    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}
