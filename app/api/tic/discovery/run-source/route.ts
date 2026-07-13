import { NextResponse } from "next/server"
import { runSourceWorker } from "@/lib/agent/workers/sourceWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { sourceId } = await request.json()

  const result = await runSourceWorker(sourceId)

  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
  })
}