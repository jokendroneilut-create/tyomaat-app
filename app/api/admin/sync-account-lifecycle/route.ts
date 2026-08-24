import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { runLifecycleSync } from "@/lib/users/accountLifecycleSync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/*
 * TILILOKIN TÄSMÄYTYS AJASTETTUNA.
 *
 * Täsmäytys oli aiemmin vain käsin ajettava skripti, ja juuri siksi se
 * unohtui: 24.8.2026 se oli ajettu viimeksi 17.8., ja 24 tunnusta oli
 * elinkaarilokin ulkopuolella. Jos joku niistä olisi poistettu, tunnuksen
 * luontipäivä ja henkilöllisyys olisivat kadonneet lopullisesti — juuri
 * se mitä `account_lifecycle` rakennettiin estämään (D-069).
 *
 * Käsiajo säilyy (`scripts/sync-account-lifecycle.ts`); molemmat käyttävät
 * samaa moduulia, jotteivät ne erkaannu.
 *
 * ?dry=1 — laske ja raportoi, älä kirjoita.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  const authHeader = request.headers.get("authorization")

  const authorized =
    (!!querySecret && querySecret === process.env.CRON_SECRET) ||
    (!!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`)

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const dry = url.searchParams.get("dry") === "1"

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const tulos = await runLifecycleSync(supabase, { apply: !dry })

    /*
     * Osittainen epäonnistuminen ei saa näyttää onnistumiselta: jos
     * kirjoitus kaatui, loki jää vajaaksi eikä sitä huomaa mistään
     * muualta.
     */
    const status = tulos.errors.length ? 500 : 200

    return NextResponse.json(
      {
        ok: !tulos.errors.length,
        dry,
        authUsers: tulos.authCount,
        knownUsers: tulos.knownUsers,
        created: tulos.created.length,
        deleted: tulos.deleted.length,
        errors: tulos.errors,
      },
      { status }
    )
  } catch (e: any) {
    console.error("ACCOUNT LIFECYCLE SYNC ERROR:", e)
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
