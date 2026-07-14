import { NextResponse } from "next/server"
import { runDiscoveryPipeline } from "@/lib/agent/pipeline/discoveryPipeline"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))

  const result = await runDiscoveryPipeline({
    maxSourceCount: body.maxSourceCount,
    maxArticleJobs: body.maxArticleJobs,
    maxPdfJobs: body.maxPdfJobs,
    maxTextJobs: body.maxTextJobs,
    maxFactJobs: body.maxFactJobs,
    stages: body.stages,
  })

  return NextResponse.json(result)
}