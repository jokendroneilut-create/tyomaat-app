import { NextResponse } from "next/server"
import { sources } from "@/lib/agent/sources"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const allCandidates: any[] = []
  const sourceStatus: any[] = []

  for (const source of sources) {
    try {
      console.log(`RUNNING SOURCE: ${source.name}`)

      const candidates = await source.fetch()

      console.log(`SOURCE OK: ${source.name} (${candidates?.length ?? 0})`)

      allCandidates.push(...(candidates || []))
      sourceStatus.push({
        source: source.name,
        ok: true,
        count: candidates?.length ?? 0,
      })
    } catch (err: any) {
      console.error(`SOURCE FAILED: ${source.name}`, err)

      sourceStatus.push({
        source: source.name,
        ok: false,
        error: err?.message || String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    count: allCandidates.length,
    candidates: allCandidates,
    source_status: sourceStatus,
  })
}