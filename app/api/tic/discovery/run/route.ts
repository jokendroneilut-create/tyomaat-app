import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 280

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

    /*
     * Koko putki ajettiin aiemmin kahtena erillisenä ajastettuna kutsuna
     * (collect + process) koska Hobby-tason 60s ei riittänyt koko putkeen
     * kerralla (mitattu n. 63-65s). Vercel Pro -päivityksen jälkeen
     * (maxDuration 280) koko putki mahtuu taas yhteen kutsuun -- mitattu
     * n. 187s maxSourceCount:illa 8 ja maxFactJobs:illa 30 tuotannossa.
     */
    const body = {
      maxSourceCount: 8,
      maxArticleJobs: 8,
      maxPdfJobs: 8,
      maxTextJobs: 8,
      maxFactJobs: 30,
    }

    const res = await fetch(`${baseUrl}/api/tic/discovery/run-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify(body),
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
