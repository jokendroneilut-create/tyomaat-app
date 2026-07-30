import { NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { importCandidate } from "@/lib/agent/importCandidate"

export const runtime = "nodejs"

/*
 * Varsinainen tuontilogiikka on lib/agent/importCandidate.ts:ssä, jotta
 * discovery-putken kerääjä voi kutsua sitä suoraan ilman HTTP-kierrosta.
 * Tämä reitti säilyy vanhan putken ja käsiajojen käyttöä varten.
 */
export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const result = await importCandidate(body)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error(err)

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
