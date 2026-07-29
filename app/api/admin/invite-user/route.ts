import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/*
 * Supabasen virheviestit ovat englanniksi ja tekniset. Käännetään yleisimmät
 * selkokielelle + toimintaohjeeksi, jotta kutsua lähettävä ei säikähdä eikä
 * jää arvailemaan mitä tehdä. Tuntemattomat virheet menevät läpi sellaisenaan.
 */
function humanizeInviteError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes("already") && m.includes("registered")) {
    return "Tälle osoitteelle on jo tili. Jos käyttäjä ei ole vielä aktivoitunut, poista hänet listalta ja lähetä kutsu uudelleen — tai käyttäjä voi asettaa salasanan 'Unohditko salasanasi?' -linkillä kirjautumissivulla."
  }
  if (m.includes("rate") || m.includes("limit") || m.includes("too many")) {
    return "Kutsuja on lähetetty liian tiheään (sähköpostipalvelun raja). Odota hetki ja yritä uudelleen. Jos tämä toistuu, sähköpostin lähetysasetukset (SMTP) kannattaa tarkistaa."
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Sähköpostiosoite ei ole kelvollinen. Tarkista kirjoitusasu."
  }
  return message
}

export async function POST(req: Request) {
  try {
    let body: any = {}

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "invalid or empty json body" }, { status: 400 })
    }

    const email = String(body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "email missing" }, { status: 400 })
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

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://app.tyomaat.fi/auth/callback",
    })

    if (error) {
      console.error("INVITE ERROR:", error)
      return NextResponse.json(
        { error: humanizeInviteError(error.message) },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      user: data.user ?? null,
    })
  } catch (err: any) {
    console.error("INVITE ROUTE ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}