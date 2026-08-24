import { NextResponse } from "next/server"
import { Resend } from "resend"

import {
  allOk,
  alertKey,
  buildAlertEmail,
  parseAdminEmails,
  type CheckResult,
} from "@/lib/health/systemHealth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Kaksi tarkistusta kerrallaan ja yksi uusinta mahtuvat tähän. Katkon
 * aikana pyyntö ei vastaa vaan roikkuu - 24.8. mitattu aika ennen
 * aikakatkaisua oli 19,6 s - joten oma katkaisu on pakollinen.
 */
const PROBE_TIMEOUT_MS = 8000
const RETRY_DELAY_MS = 3000

export const maxDuration = 30

async function probe(
  name: string,
  url: string,
  apikey: string,
  extraHeaders: Record<string, string> = {}
): Promise<CheckResult> {
  const alkoi = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const r = await fetch(url, {
      headers: { apikey, ...extraHeaders },
      signal: controller.signal,
      cache: "no-store",
    })
    return { name, ok: r.ok, status: r.status, ms: Date.now() - alkoi }
  } catch (e: any) {
    /*
     * Aikakatkaisu on tässä yhtä vakava kuin virhekoodi: asiakkaan
     * selain jää samalla tavalla roikkumaan.
     */
    const syy = e?.name === "AbortError" ? `aikakatkaisu ${PROBE_TIMEOUT_MS} ms` : String(e?.message ?? e)
    return { name, ok: false, status: null, ms: Date.now() - alkoi, error: syy }
  } finally {
    clearTimeout(timer)
  }
}

async function runChecks(): Promise<CheckResult[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return Promise.all([
    /* Tämä on se joka esti kirjautumisen 24.8. */
    probe("kirjautuminen", `${base}/auth/v1/health`, anon),
    /* Kanta erikseen: auth voi olla pystyssä vaikka Postgres ei vastaa. */
    probe("tietokanta", `${base}/rest/v1/projects?select=id&limit=1`, service, {
      Authorization: `Bearer ${service}`,
    }),
  ])
}

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

  /* Testilippu, jolla hälytyksen sisällön näkee lähettämättä sitä. */
  const dry = url.searchParams.get("dry") === "1"

  let results = await runChecks()

  /*
   * VARMISTUS ENNEN HÄLYTYSTÄ. Supabasella on avoin häiriö ajoittaisista
   * 401-virheistä, ja hetkellinen piikki ei ole kaatunut instanssi.
   * 24.8. vika oli pysyvä: kuusi peräkkäistä tarkistusta viiden sekunnin
   * välein antoi 522:n joka kerta, joten aito katko selviää uusinnasta.
   */
  let retried = false
  if (!allOk(results)) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    results = await runChecks()
    retried = true
  }

  const ok = allOk(results)
  const now = new Date()

  if (ok) {
    return NextResponse.json({ ok: true, retried, checks: results })
  }

  const { subject, text } = buildAlertEmail(results, now)
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
  const from = process.env.MAIL_FROM

  if (dry) {
    return NextResponse.json({ ok: false, dry: true, to: admins, subject, text, checks: results })
  }

  if (!admins.length || !from || !process.env.RESEND_API_KEY) {
    /*
     * Vahti ei saa kaatua äänettömästi. Jos hälytystä ei voi lähettää,
     * se sanotaan vastauksessa ääneen.
     */
    return NextResponse.json(
      { ok: false, alerted: false, reason: "ADMIN_EMAILS, MAIL_FROM tai RESEND_API_KEY puuttuu", checks: results },
      { status: 500 }
    )
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    /*
     * IDEMPOTENSSI KORVAA TILATAULUN. Vahti ei voi muistaa lähettäneensä
     * jo hälytyksen, koska ainoa muisti olisi Supabase - se sama palvelu
     * joka on alhaalla. Tunnin tarkkuudella laskettu avain siirtää muistin
     * Resendin päähän: saman tunnin sisällä viesti lähtee kerran, vaikka
     * tarkistus ajettaisiin viiden minuutin välein.
     */
    await resend.emails.send(
      { from, to: admins, subject, text },
      { idempotencyKey: alertKey(now) }
    )

    return NextResponse.json({ ok: false, alerted: true, checks: results })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, alerted: false, reason: String(e?.message ?? e), checks: results },
      { status: 500 }
    )
  }
}
