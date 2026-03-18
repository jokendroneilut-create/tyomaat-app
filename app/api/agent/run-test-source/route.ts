import { NextResponse } from "next/server"


export const runtime = "nodejs"

export async function POST() {
  try {
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"

const discoverRes = await fetch(`${baseUrl}/api/agent/discover`)
const discoverJson = await discoverRes.json()

const candidates = discoverJson.candidates || []

    const results: any[] = []

   for (const candidate of candidates) {
    if (!candidate.source_url) continue
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"

const existingRes = await fetch(
  `${baseUrl}/api/agent/seen-source?source_url=${encodeURIComponent(candidate.source_url)}`,
  {
    method: "GET",
  }
)

const existingJson = await existingRes.json()

if (existingJson.seen) {
  results.push({
    source_name: candidate.source_name || "unknown",
    candidate: candidate.name,
    ok: true,
    status: "skipped_seen_source",
  })
  continue
}
  try {

    const res = await fetch(`${baseUrl}/api/agent/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(candidate),
    })

    const json = await res.json()

    results.push({
      source_name: candidate.source_name || "unknown",
      candidate: candidate.name,
      ok: res.ok,
      ...json,
    })
  } catch (err: any) {
    results.push({
      source_name: candidate.source_name || "unknown",
      candidate: candidate.name,
      ok: false,
      error: err?.message || "unknown error",
    })
  }
}
const summary = results.reduce((acc: any, row: any) => {
  const source = row.source_name || "unknown"
  const status = row.status || (row.ok ? "ok" : "error")

  if (!acc[source]) {
    acc[source] = {}
  }

  acc[source][status] = (acc[source][status] || 0) + 1

  return acc
}, {})
const totalProcessed = results.filter(
  (r) => r.status !== "skipped_seen_source"
).length
const sourceCounts = candidates.reduce((acc: any, candidate: any) => {
  const source = candidate.source_name || "unknown"
  acc[source] = (acc[source] || 0) + 1
  return acc
}, {})
    return NextResponse.json({
  ok: true,
  count: candidates.length,
  processed: totalProcessed,
  source_counts: sourceCounts,
  summary,
  results,
})
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      {
        error: err.message,
      },
      { status: 500 }
    )
  }
}