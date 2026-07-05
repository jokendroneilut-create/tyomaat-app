import { NextResponse } from "next/server"
import { runFactWorker } from "@/lib/agent/workers/factWorker"

export async function POST() {
  const result = await runFactWorker()

  return NextResponse.json(result)
}