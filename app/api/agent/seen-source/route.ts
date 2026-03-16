import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const sourceUrl = url.searchParams.get("source_url")

    if (!sourceUrl) {
      return NextResponse.json(
        { error: "source_url is required" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from("project_sources")
      .select("id,last_seen_at")
      .eq("source_url", sourceUrl)
      .order("last_seen_at", { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    const latest = data?.[0]

    if (!latest?.last_seen_at) {
      return NextResponse.json({ seen: false })
    }

    const lastSeenAt = new Date(latest.last_seen_at).getTime()
    const now = Date.now()
    const hours24 = 24 * 60 * 60 * 1000

    return NextResponse.json({
      seen: now - lastSeenAt < hours24,
    })
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}