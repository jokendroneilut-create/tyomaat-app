import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { canSeeOwnCustomers, isAdmin } from "@/lib/auth/roles"

export const runtime = "nodejs"

/*
 * Kayttajalista.
 *
 * Admin nakee kaikki. Myyja nakee VAIN hankkimansa asiakkaat, ja rajaus
 * tehdaan tassa palvelimella - ei kayttoliittymassa, jossa sen voi
 * ohittaa. Tavallinen kayttaja ei nae mitaan.
 */
export async function GET(req: Request) {
  try {
    const kutsuja = await getRequestRole(req)

    if (!kutsuja.ok) {
      return NextResponse.json({ error: kutsuja.error }, { status: kutsuja.status })
    }

    if (!canSeeOwnCustomers(kutsuja.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    let allUsers: any[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const usersBatch = data.users || []
      allUsers = allUsers.concat(usersBatch)

      if (usersBatch.length < perPage) {
        break
      }

      page++
    }

    /*
     * Liitokset ja roolit haetaan erikseen, jotta puuttuva taulu ei
     * kaada listaa ennen kuin DDL on ajettu.
     */
    const omistajat = new Map<string, string>()
    const roolit = new Map<string, string>()

    const { data: liitokset, error: liitosVirhe } = await supabase
      .from("customer_owners")
      .select("user_id,seller_id")

    if (liitosVirhe) console.error("Liitosten haku epaonnistui:", liitosVirhe.message)
    else (liitokset ?? []).forEach((r: any) => omistajat.set(r.user_id, r.seller_id))

    const { data: roolirivit, error: rooliVirhe } = await supabase
      .from("user_roles")
      .select("user_id,role")

    if (rooliVirhe) console.error("Roolien haku epaonnistui:", rooliVirhe.message)
    else (roolirivit ?? []).forEach((r: any) => roolit.set(r.user_id, r.role))

    const sahkopostit = new Map<string, string | null>(
      allUsers.map((u) => [u.id, u.email ?? null])
    )

    const kaikki = allUsers
      .map((u) => {
        const ownerId = omistajat.get(u.id) ?? null

        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed: Boolean(u.email_confirmed_at),
          /*
           * Lukitustila luetaan `app_metadata`sta, koska sinne mahtuu myös
           * PERUSTELU — `banned_until` kertoisi vain päivämäärän. Lukitusreitti
           * kirjoittaa molemmat: `ban_duration` estää kirjautumisen,
           * `app_metadata` kertoo tilan ja syyn näytettäväksi.
           */
          locked: Boolean((u as any).app_metadata?.locked),
          lockedReason: (u as any).app_metadata?.locked_reason ?? null,

          role: roolit.get(u.id) ?? "user",
          ownerId,
          ownerEmail: ownerId ? (sahkopostit.get(ownerId) ?? null) : null,
        }
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

    /* Myyjalle vain omat asiakkaat. */
    const users = isAdmin(kutsuja.role)
      ? kaikki
      : kaikki.filter((u) => u.ownerId === kutsuja.userId)

    /* Admin tarvitsee myyjalistan liittamista varten. */
    const sellers = isAdmin(kutsuja.role)
      ? kaikki
          .filter((u) => u.role === "seller")
          .map((u) => ({ id: u.id, email: u.email }))
      : []

    return NextResponse.json({
      ok: true,
      role: kutsuja.role,
      users,
      sellers,
    })
  } catch (err: any) {
    console.error("LIST USERS ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}
