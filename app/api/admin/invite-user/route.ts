import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    let body: any = {}

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "invalid or empty json body" }, { status: 400 })
    }

    const email = String(body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "email missing" }, { status: 400 })
    }

    console.log("INVITE EMAIL:", email)
    console.log("HAS SERVICE ROLE KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://tyomaat-app.vercel.app/auth/callback",
    })

    if (error) {
      console.error("INVITE ERROR:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      user: data.user ?? null,
    })
  } catch (err: any) {
    console.error("INVITE ROUTE ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}