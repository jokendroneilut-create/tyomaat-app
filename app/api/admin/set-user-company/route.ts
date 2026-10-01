import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { isAdmin } from "@/lib/auth/roles"
import { asiakkaanTunniste } from "@/lib/users/asiakastunniste"

export const runtime = "nodejs"

/*
 * KAYTTAJAN YRITYS. VAIN ADMIN (D-224).
 *
 * Tyhja nimi poistaa valinnan, jolloin asiakas paatellaan taas
 * sahkopostista.
 *
 * LASKUTUSRIVI SEURAA MUKANA. Yrityksen valinta vaihtaa asiakkaan
 * tunnisteen, joten aiemmin kirjattu hinta jaisi vanhan tunnisteen alle
 * ja katoaisi nakyvista. Se on hiljainen tiedon menetys, joten rivi
 * kopioidaan uudelle tunnisteelle — mutta vain jos uudella ei ole omaa
 * rivia. Olemassa olevaa tietoa ei koskaan ylikirjoiteta.
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
    const yritys = typeof body?.yritys === "string" ? body.yritys.trim().replace(/\s+/g, " ") : ""

    if (!userId) {
      return NextResponse.json({ error: "userId puuttuu" }, { status: 400 })
    }

    if (yritys.length > 120) {
      return NextResponse.json({ error: "Yrityksen nimi on liian pitka" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    /* Sahkoposti tarvitaan tunnisteen laskemiseen molemmissa suunnissa. */
    const { data: kayttaja, error: kayttajaVirhe } = await supabase.auth.admin.getUserById(userId)
    if (kayttajaVirhe || !kayttaja?.user) {
      return NextResponse.json({ error: "Kayttajaa ei loytynyt" }, { status: 404 })
    }

    const email = kayttaja.user.email ?? null

    const { data: vanhaRivi } = await supabase
      .from("user_company")
      .select("yritys")
      .eq("user_id", userId)
      .maybeSingle()

    const vanhaTunniste = asiakkaanTunniste(email, vanhaRivi?.yritys ?? null)
    const uusiTunniste = asiakkaanTunniste(email, yritys || null)

    if (!yritys) {
      const { error } = await supabase.from("user_company").delete().eq("user_id", userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from("user_company")
        .upsert(
          { user_id: userId, yritys, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    /* Laskutusrivin siirto, kun tunniste vaihtui. */
    let siirretty = false

    if (vanhaTunniste && uusiTunniste && vanhaTunniste !== uusiTunniste) {
      const { data: vanhaLasku } = await supabase
        .from("customer_billing")
        .select("tila,kuukausihinta_eur,alkaen,huomio")
        .eq("tunniste", vanhaTunniste)
        .maybeSingle()

      if (vanhaLasku) {
        const { data: uusiLasku } = await supabase
          .from("customer_billing")
          .select("tunniste")
          .eq("tunniste", uusiTunniste)
          .maybeSingle()

        if (!uusiLasku) {
          const { error } = await supabase.from("customer_billing").insert({
            tunniste: uusiTunniste,
            tila: vanhaLasku.tila,
            kuukausihinta_eur: vanhaLasku.kuukausihinta_eur,
            alkaen: vanhaLasku.alkaen,
            huomio: vanhaLasku.huomio,
            updated_at: new Date().toISOString(),
          })
          if (!error) siirretty = true
        }
      }
    }

    return NextResponse.json({ ok: true, userId, yritys: yritys || null, billingKey: uusiTunniste, siirretty })
  } catch (err: any) {
    console.error("SET USER COMPANY ERROR:", err)
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 })
  }
}
