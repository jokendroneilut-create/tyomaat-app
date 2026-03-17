import { NextResponse } from "next/server"
import { fetchTestSource } from "@/lib/agent/fetchTestSource"
import { fetchYitSource } from "@/lib/agent/fetchYitSource"

export const runtime = "nodejs"

export async function GET() {
  try {
    const lapti = await fetchTestSource()
    const yit = await fetchYitSource()

    const candidates = [...lapti, ...yit]

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