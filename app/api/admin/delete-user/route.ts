import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { NOLLATTUJEN_KENTTA } from "@/lib/analytics/tunnistamattomat"

export const runtime = "nodejs"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function POST(req: Request) {
  try {
    let body: any = {}

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "invalid or empty json body" }, { status: 400 })
    }

    const userId = String(body.userId || "").trim()

    if (!userId) {
      return NextResponse.json({ error: "userId missing" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing auth token" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "").trim()

    const {
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(token)

    if (callerError || !caller) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)

    if (!admins.includes((caller.email || "").toLowerCase())) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    if (userId === caller.id) {
      return NextResponse.json(
        { error: "et voi poistaa omaa tunnustasi" },
        { status: 400 }
      )
    }

    /*
     * ELINKAARI KIRJATAAN ENNEN POISTOA.
     *
     * deleteUser on kova poisto: sen jälkeen tunnuksesta ei ole jäljellä
     * mitään, ei sähköpostia eikä luontipäivää. Silloin katoaa myös tieto
     * siitä mihin kohorttiin tili kuului ja konvertoituiko se. Tiedot on
     * siis luettava ja kirjattava kun ne vielä ovat olemassa.
     *
     * Kirjaus ei saa estää poistoa: jos loki epäonnistuu, poisto tehdään
     * silti ja virhe jää lokiin. Poisto on käyttäjän pyyntö, loki on
     * meidän kirjanpitoamme.
     */
    try {
      const { data: target } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle()

      /*
       * Luontipaiva otetaan auth.usersista, ei profilesista:
       * profiles.created_at on profiilirivin luontipaiva, ei tilin.
       * Mitattu 15.8.2026: 40 profiilirivia oli luotu samana paivana
       * taulun kayttoonoton taydennysajossa, ja suurin ero tilin
       * todelliseen luontipaivaan oli 78 vuorokautta.
       */
      const { data: authTarget } = await supabase.auth.admin.getUserById(userId)
      const email = authTarget?.user?.email ?? target?.email ?? null

      /*
       * "created" kirjataan tassa myos: jos tilia ei ole ehditty
       * synkata, poiston jalkeen luontipaivaa ei saa mistaan - tili
       * katoaisi kohorttiluvuista kokonaan.
       */
      const rows: any[] = []

      if (authTarget?.user?.created_at) {
        rows.push({
          user_id: userId,
          email,
          full_name: target?.full_name ?? null,
          event: "created",
          occurred_at: authTarget.user.created_at,
          metadata: { source: "admin_delete_user_backfill" },
        })
      }

      /*
       * MONTAKO ANALYTIIKKARIVIÄ POISTO NOLLAA?
       *
       * `analytics_events.user_id` on `ON DELETE SET NULL`: tapahtuma jää
       * tilastoon, henkilöyhteys katkeaa. Se on oikea ratkaisu, mutta se
       * tuottaa nollarivejä — ja nollarivi on analytiikan hälytysmittari
       * tuntemattomasta kirjoittajasta (D-083).
       *
       * Määrä on laskettava NYT, koska poiston jälkeen sitä ei saa enää
       * mistään: rivit ovat tallessa mutta yhteys käyttäjään on poikki.
       * Ilman tätä lukua hälytys ei voi erottaa omaa siivousta
       * ulkopuolisesta kirjoittajasta (D-184).
       */
      let nollattavia: number | null = null
      try {
        const { count } = await supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
        nollattavia = count ?? 0
      } catch (countErr: any) {
        console.error("ANALYTICS COUNT FAILED:", countErr?.message ?? countErr)
      }

      rows.push({
        user_id: userId,
        email,
        full_name: target?.full_name ?? null,
        event: "deleted",
        occurred_at: new Date().toISOString(),
        metadata: {
          source: "admin_delete_user",
          deleted_by: caller.email ?? null,
          ...(nollattavia != null ? { [NOLLATTUJEN_KENTTA]: nollattavia } : {}),
        },
      })

      const { error: logError } = await supabase
        .from("account_lifecycle")
        .upsert(rows, { onConflict: "user_id,event", ignoreDuplicates: true })

      if (logError) {
        console.error("ACCOUNT LIFECYCLE LOG FAILED:", logError.message)
      }
    } catch (logErr: any) {
      console.error("ACCOUNT LIFECYCLE LOG FAILED:", logErr?.message ?? logErr)
    }

    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE USER ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}
