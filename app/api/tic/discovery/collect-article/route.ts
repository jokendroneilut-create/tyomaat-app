import { NextResponse } from "next/server"
import { collectArticleDocument } from "@/lib/agent/discovery/collectors/articleCollector"

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "documentId missing" },
        { status: 400 }
      )
    }

    const result = await collectArticleDocument(documentId)

    return NextResponse.json({
      ok: true,
      result,
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    })
  }
}