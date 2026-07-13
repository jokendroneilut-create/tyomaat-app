import { NextResponse } from "next/server"
import { runTextExtractionWorker } from "@/lib/agent/workers/textExtractionWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runTextExtractionWorker()

  return NextResponse.json(result)
}