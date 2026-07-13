import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ALLOWED_EVENT_TYPES = new Set(["login", "pageview", "project_open"])

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || !ALLOWED_EVENT_TYPES.has(body.event_type)) {
      return NextResponse.json({ error: "invalid event_type" }, { status: 400 })
    }

    /*
     * user_id luetaan aina palvelimella session-evästeestä, ei koskaan
     * clientin lähettämästä arvosta — muuten kuka tahansa voisi vääristää
     * toisen käyttäjän tilastoja.
     */
    const cookieStore = await cookies()

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      // Ei kirjautunutta käyttäjää — ei virhettä, vain hiljainen no-op.
      return NextResponse.json({ ok: true, tracked: false })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin.from("analytics_events").insert({
      user_id: user.id,
      event_type: body.event_type,
      path: typeof body.path === "string" ? body.path.slice(0, 500) : null,
      project_id: typeof body.project_id === "string" ? body.project_id : null,
      duration_seconds:
        typeof body.duration_seconds === "number" && body.duration_seconds >= 0
          ? Math.round(body.duration_seconds)
          : null,
      device_type: body.device_type === "mobile" ? "mobile" : "desktop",
    })

    if (error) {
      console.error("ANALYTICS TRACK ERROR:", error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tracked: true })
  } catch (err: any) {
    console.error("ANALYTICS TRACK ROUTE ERROR:", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
