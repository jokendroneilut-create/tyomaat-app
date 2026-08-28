import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { isAdmin } from "@/lib/auth/roles"

export const runtime = "nodejs"

/*
 * Asiakkaan liittaminen myyjalle. VAIN ADMIN.
 *
 * sellerId: myyjan tunnus, tai null joka poistaa liitoksen.
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
    const sellerId =
      body?.sellerId === null || body?.sellerId === ""
        ? null
        : typeof body?.sellerId === "string"
          ? body.sellerId.trim()
          : ""

    if (!userId) {
      return NextResponse.json({ error: "userId puuttuu" }, { status: 400 })
    }

    if (sellerId === "") {
      return NextResponse.json({ error: "sellerId on virheellinen" }, { status: 400 })
    }

    if (sellerId && sellerId === userId) {
      return NextResponse.json(
        { error: "Myyja ei voi olla oma asiakkaansa" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    if (sellerId === null) {
      const { error } = await supabase.from("customer_owners").delete().eq("user_id", userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, sellerId: null })
    }

    /*
     * Liitettavan on oltava myyja. Tarkistus on tassa eika kannassa,
     * koska rooli voi tulla myos ADMIN_EMAILS-listalta - kanta ei voi
     * tietaa siita.
     */
    const { data: rooli, error: rooliVirhe } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sellerId)
      .maybeSingle()

    if (rooliVirhe) {
      return NextResponse.json({ error: rooliVirhe.message }, { status: 500 })
    }

    if (rooli?.role !== "seller" && rooli?.role !== "admin") {
      return NextResponse.json(
        { error: "Valittu tunnus ei ole myyja" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("customer_owners")
      .upsert({ user_id: userId, seller_id: sellerId }, { onConflict: "user_id" })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, sellerId })
  } catch (err: any) {
    console.error("ASSIGN CUSTOMER ERROR:", err)
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 })
  }
}
