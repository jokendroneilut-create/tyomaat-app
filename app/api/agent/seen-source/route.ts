import { NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { isSourceUrlSeenRecently } from "@/lib/agent/importCandidate"

export const runtime = "nodejs"

/*
 * Tarkistuslogiikka on lib/agent/importCandidate.ts:ssä samasta syystä kuin
 * tuontikin: discovery-putken kerääjä kutsuu sitä suoraan.
 */
export async function GET(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const url = new URL(req.url)
    const sourceUrl = url.searchParams.get("source_url")

    if (!sourceUrl) {
      return NextResponse.json(
        { error: "source_url is required" },
        { status: 400 }
      )
    }

    return NextResponse.json({ seen: await isSourceUrlSeenRecently(sourceUrl) })
  } catch (err: any) {
    console.error(err)

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
