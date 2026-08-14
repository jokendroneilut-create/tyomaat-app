import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
        .select("email, full_name, created_at")
        .eq("id", userId)
        .maybeSingle()

      const { error: logError } = await supabase.from("account_lifecycle").upsert(
        {
          user_id: userId,
          email: target?.email ?? null,
          full_name: target?.full_name ?? null,
          event: "deleted",
          occurred_at: new Date().toISOString(),
          metadata: { source: "admin_delete_user", deleted_by: caller.email ?? null },
        },
        { onConflict: "user_id,event" }
      )

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
