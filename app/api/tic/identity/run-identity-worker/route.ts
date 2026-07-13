import { NextResponse } from "next/server"
import { runIdentityWorker } from "@/lib/agent/workers/identityWorker"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))

  const documentId = body.documentId

  if (!documentId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing documentId",
      },
      { status: 400 }
    )
  }

  const result = await runIdentityWorker(documentId)

  return NextResponse.json(result)
}