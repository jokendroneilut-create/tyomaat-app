import { NextResponse } from "next/server"
import { runReleaseBodyWorker } from "@/lib/agent/workers/releaseBodyWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"
export const maxDuration = 300

/*
 * Ajastettu ajo. Sama tunnistustapa kuin `/api/tic/discovery/run`:issa —
 * Vercelin cron lähettää GET-pyynnön Bearer-otsikolla, ja `?secret=` sallii
 * saman ajon käsin.
 *
 * Erillinen ajastus eikä osa discovery-ajoa: koko pointti on irrottaa
 * sivuhaut lähdeajon aikabudjetista (D-075).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  const authHeader = request.headers.get("authorization")

  const authorized =
    (!!querySecret && querySecret === process.env.CRON_SECRET) ||
    (!!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`)

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const limit = Number(url.searchParams.get("limit"))

  const result = await runReleaseBodyWorker(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : undefined
  )

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Number(body?.limit)

  const result = await runReleaseBodyWorker(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : undefined
  )

  return NextResponse.json(result)
}
