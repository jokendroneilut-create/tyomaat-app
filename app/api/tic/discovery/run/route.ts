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

    /*
     * Koko putki yhdessä pyynnössä ylitti toistuvasti Hobby-tason 60s
     * aikarajan (mitattu n. 63-65s), jolloin faktat/tunnistus eivät
     * ehtineet käynnistyä lainkaan ja dokumentit jäivät pysyvästi jonoon.
     * vercel.json ajastaa nyt kaksi erillistä kutsua eri kellonaikoina:
     * "collect" (keräys) ja muutama minuutti myöhemmin "process"
     * (faktat+tunnistus) — kumpikin omalla 60s-budjetillaan. Käsiajo
     * (admin-paneelin "secret"-parametrilla) ajaa edelleen kaiken kerralla.
     */
    const stage = url.searchParams.get("stage")

    const body =
      stage === "collect"
        ? {
            stages: ["sources", "articles", "pdfs", "texts"],
            maxSourceCount: 5,
            maxArticleJobs: 5,
            maxPdfJobs: 5,
            maxTextJobs: 5,
          }
        : stage === "process"
          ? {
              stages: ["facts"],
              maxFactJobs: 15,
            }
          : {
              maxSourceCount: 5,
              maxArticleJobs: 5,
              maxPdfJobs: 5,
              maxTextJobs: 5,
              maxFactJobs: 5,
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
