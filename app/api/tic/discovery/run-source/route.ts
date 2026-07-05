import { NextResponse } from "next/server"
import { runSourceWorker } from "@/lib/agent/workers/sourceWorker"

export async function POST(request: Request) {
  const { sourceId } = await request.json()

  const result = await runSourceWorker(sourceId)

  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
  })
}