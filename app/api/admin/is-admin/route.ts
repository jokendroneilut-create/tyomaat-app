import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "").trim()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }

    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
    const userEmail = (user.email || "").toLowerCase()

    return NextResponse.json({
      isAdmin: admins.includes(userEmail),
    })
  } catch (err: any) {
    console.error("IS ADMIN ERROR:", err)

    return NextResponse.json(
      { isAdmin: false, error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}