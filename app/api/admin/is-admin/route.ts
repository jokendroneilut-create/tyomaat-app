import { NextResponse } from "next/server"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { isAdmin } from "@/lib/auth/roles"

export const runtime = "nodejs"

/*
 * Kertoo kutsujalle oman roolinsa.
 *
 * `isAdmin` sailytetaan, koska sita luetaan useassa nakymassa
 * (mm. /projects "Muokkaa"-linkki). `role` on uusi ja tarpeen
 * myyjatasolle, joka ei ole admin muttei tavallinen kayttajakaan.
 */
export async function GET(req: Request) {
  try {
    const tulos = await getRequestRole(req)

    if (!tulos.ok) {
      return NextResponse.json(
        { isAdmin: false, role: "user" },
        { status: tulos.status }
      )
    }

    return NextResponse.json({
      isAdmin: isAdmin(tulos.role),
      role: tulos.role,
    })
  } catch (err: any) {
    console.error("IS ADMIN ERROR:", err)

    return NextResponse.json(
      { isAdmin: false, role: "user", error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}
