import { NextResponse } from "next/server"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await resolvePotentialProject({
    title: "Testihanke Palotie 29",
    municipality: "Espoo",
    address: "Palotie 29",
    sourceName: "manual_test",
    metadata: {
      test: true,
    },
  })

  return NextResponse.json(result)
}