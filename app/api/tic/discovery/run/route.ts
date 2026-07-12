import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")

    const isManualRun =
      !!querySecret && querySecret === process.env.CRON_SECRET

    const isCronRun =
      !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isManualRun && !isCronRun) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"

    // Hobby-tason 60s aikarajan sisällä pysymiseksi ajetaan yöllinen
    // cron pienemmällä erällä kuin käsin ajettu oletuserä.
    const res = await fetch(`${baseUrl}/api/tic/discovery/run-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxSourceCount: 5,
        maxArticleJobs: 5,
        maxPdfJobs: 5,
        maxTextJobs: 5,
        maxFactJobs: 5,
      }),
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
