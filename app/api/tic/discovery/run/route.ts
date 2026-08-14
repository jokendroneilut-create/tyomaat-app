import { NextResponse } from "next/server"
import {
  DISCOVERY_CRON_CONFIG,
  DISCOVERY_PROCESS_CONFIG,
} from "@/lib/agent/pipeline/cronConfig"

export const runtime = "nodejs"
export const maxDuration = 500

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
    /*
     * KAKSI AJOTYYPPIA SAMAN REITIN TAKANA.
     *
     * `?mode=process` ajaa vain kasittelyvaiheen omalla budjetillaan.
     * Kerays ja kasittely jakoivat aiemmin saman ajan, jolloin kasittely
     * sai vain sen mita keraykselta jai yli - mitattu 14.8.2026 klo 21:
     * lahteet 317 s, faktavaiheelle jai minuutti, jono kasvoi 34 -> 41.
     *
     * Sama reitti eika uutta siksi, etta tunnistus ja lokitus ovat jo
     * tassa - toinen reitti kahdentaisi ne.
     */
    const mode = url.searchParams.get("mode")
    const body =
      mode === "process" ? DISCOVERY_PROCESS_CONFIG : DISCOVERY_CRON_CONFIG

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
      mode: mode === "process" ? "process" : "collect",
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
