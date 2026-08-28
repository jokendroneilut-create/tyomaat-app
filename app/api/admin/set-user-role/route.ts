import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { isAdmin } from "@/lib/auth/roles"

export const runtime = "nodejs"

/*
 * Roolin myontaminen ja poistaminen. VAIN ADMIN.
 *
 * Kirjoitus kulkee tasta service rolella, koska user_roles-taulussa ei
 * ole kayttajan kirjoituspolitiikkaa - muuten kayttaja voisi korottaa
 * itsensa.
 *
 * role: "seller" | "admin" | null  (null poistaa rivin)
 */
export async function POST(req: Request) {
  try {
    const kutsuja = await getRequestRole(req)

    if (!kutsuja.ok) {
      return NextResponse.json({ error: kutsuja.error }, { status: kutsuja.status })
    }

    if (!isAdmin(kutsuja.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const userId = typeof body?.userId === "string" ? body.userId.trim() : ""
    const role = body?.role === null ? null : String(body?.role ?? "")

    if (!userId) {
      return NextResponse.json({ error: "userId puuttuu" }, { status: 400 })
    }

    if (role !== null && role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: 'role on oltava "seller", "admin" tai null' },
        { status: 400 }
      )
    }

    /*
     * Admin ei voi poistaa omaa admin-rooliaan tasta. ADMIN_EMAILS
     * kantaisi hanet yha lapi, mutta virhe olisi hammentava - parempi
     * estaa se selvasti.
     */
    if (userId === kutsuja.userId && role !== "admin") {
      return NextResponse.json(
        { error: "Et voi poistaa omaa admin-rooliasi" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    if (role === null) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      /* Rooli pois -> myos liitokset hanelle kuuluvista asiakkaista. */
      const { error: liitosVirhe } = await supabase
        .from("customer_owners")
        .delete()
        .eq("seller_id", userId)

      if (liitosVirhe) {
        console.error("Liitosten poisto epaonnistui:", liitosVirhe.message)
      }

      return NextResponse.json({ ok: true, role: "user" })
    }

    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, role })
  } catch (err: any) {
    console.error("SET USER ROLE ERROR:", err)
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 })
  }
}
