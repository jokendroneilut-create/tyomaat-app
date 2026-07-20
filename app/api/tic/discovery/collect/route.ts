import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/*
 * Erillinen reitti (ei /api/tic/discovery/run?stage=collect) koska Vercel
 * näytti rekisteröivän cron-ajot polun mukaan välittämättä query-stringistä
 * -- collect- ja process-vaiheen jakaminen samalle polulle vain eri
 * parametrilla johti siihen, ettei collect-ajo koskaan päätynyt Vercelin
 * ajastettujen tehtävien listalle lainkaan (process, joka on vercel.json:ssa
 * collectin jälkeen, näytti "voittavan").
 */
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

    const res = await fetch(`${baseUrl}/api/tic/discovery/run-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        stages: ["sources", "articles", "pdfs", "texts"],
        maxSourceCount: 2,
        maxArticleJobs: 5,
        maxPdfJobs: 5,
        maxTextJobs: 5,
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
