import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runSource } from "@/lib/agent/pipeline/runSource"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { data: source, error } = await supabaseAdmin
      .from("agent_sources")
      .select("*")
      .eq("enabled", true)
      .eq("source_type", "rss")
      .order("priority", { ascending: true })
      .limit(1)
      .single()

    if (error) throw error
    if (!source) {
      return NextResponse.json({ ok: false, error: "No source found" }, { status: 404 })
    }

    const result = await runSource(source)

    await supabaseAdmin
      .from("agent_sources")
      .update({
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", source.id)

    return NextResponse.json({
      ok: true,
      result,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
      },
      { status: 500 }
    )
  }
}