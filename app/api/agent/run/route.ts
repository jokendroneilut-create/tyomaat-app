import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get("secret")

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"

    const res = await fetch(`${baseUrl}/api/agent/run-test-source`, {
      method: "POST",
    })

    const json = await res.json()

    return NextResponse.json({
  ok: true,
  ran_at: new Date().toISOString(),
  result: json,
})
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      {
        error: err.message,
      },
      { status: 500 }
    )
  }
}