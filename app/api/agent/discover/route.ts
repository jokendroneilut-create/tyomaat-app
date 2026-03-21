import { NextResponse } from "next/server"
import { sources } from "@/lib/agent/sources"

export const runtime = "nodejs"

export async function GET() {
  try {
    const sourceResults = await Promise.all(
  sources.map(async (source) => {
    const candidates = await source.fetch()
    return candidates
  })
)

const candidates = sourceResults.flat()

    return NextResponse.json({
      ok: true,
      count: candidates.length,
      candidates,
    })
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}