import { NextResponse } from "next/server"
import { runPdfWorker } from "@/lib/agent/workers/pdfWorker"

export async function POST() {
  const result = await runPdfWorker()

  return NextResponse.json(result)
}