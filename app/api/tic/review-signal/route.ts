import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const body = await req.json()

    const signalId = body.signalId as string
    const action = body.action as "approve" | "reject"

    if (!signalId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request" },
        { status: 400 }
      )
    }

    const update =
      action === "approve"
        ? {
            review_status: "approved",
            approved_at: new Date().toISOString(),
            rejected_at: null,
          }
        : {
            review_status: "ignored",
            rejected_at: new Date().toISOString(),
            approved_at: null,
          }

    const { data, error } = await supabaseAdmin
      .from("project_signals")
      .update(update)
      .eq("id", signalId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, signal: data })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    )
  }
}