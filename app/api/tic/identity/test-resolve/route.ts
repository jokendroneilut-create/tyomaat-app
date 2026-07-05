import { NextResponse } from "next/server"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"

export async function POST() {
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