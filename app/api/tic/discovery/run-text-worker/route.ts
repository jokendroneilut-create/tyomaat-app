import { NextResponse } from "next/server"
import { runTextExtractionWorker } from "@/lib/agent/workers/textExtractionWorker"

export async function POST() {
  const result = await runTextExtractionWorker()

  return NextResponse.json(result)
}