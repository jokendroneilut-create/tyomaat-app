import { NextResponse } from "next/server"
import { runIdentityWorker } from "@/lib/agent/workers/identityWorker"

export async function POST(request: Request) {
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