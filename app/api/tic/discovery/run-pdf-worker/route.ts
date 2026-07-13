import { NextResponse } from "next/server"
import { runPdfWorker } from "@/lib/agent/workers/pdfWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runPdfWorker()

  return NextResponse.json(result)
}