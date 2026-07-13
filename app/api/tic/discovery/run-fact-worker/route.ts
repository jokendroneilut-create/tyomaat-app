import { NextResponse } from "next/server"
import { runFactWorker } from "@/lib/agent/workers/factWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runFactWorker()

  return NextResponse.json(result)
}