import { NextResponse } from "next/server"
import { runDiscoveryPipeline } from "@/lib/agent/pipeline/discoveryPipeline"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  const result = await runDiscoveryPipeline({
    maxSourceCount: body.maxSourceCount,
    maxPdfJobs: body.maxPdfJobs,
    maxTextJobs: body.maxTextJobs,
    maxFactJobs: body.maxFactJobs,
  })

  return NextResponse.json(result)
}