import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"

/*
 * POIKKEAVAN KÄYTÖN ILMOITUS.
 *
 * ILMOITUS, EI LUKITUS — ja se on tarkoituksellista. Perustaso mitattiin
 * 17.8.2026 ilman ylläpitäjän omaa käyttöä: 28 asiakasta on avannut
 * hankkeita, mediaani 6 eri hanketta, innokkain 43. Mikä tahansa
 * automaattinen raja lähellä todellista käyttöä lukitsisi ennen pitkää
 * maksavan asiakkaan kesken työpäivän, ja virheen hinnat ovat
 * epäsymmetriset: väärä lukitus maksaa asiakassuhteen, myöhästynyt
 * havainto muutaman tunnin dataa.
 *
 * Lisäksi automaattinen raja opettaa kaappaajalle missä raja on. Hiljainen
 * ilmoitus ylläpitäjälle ei opeta mitään ulospäin.
 *
 * KYNNYS on siksi selvästi yli todellisen käytön — noin viisinkertainen
 * innokkaimpaan asiakkaaseen. Koko hankekannan läpikäynti vaatisi yli
 * 5 000 avausta, joten aito kaappaus ylittää tämän moninkertaisesti eikä
 * kynnyksen tarkka arvo ratkaise.
 */
const DISTINCT_PROJECTS_THRESHOLD = 200

/* Ikkuna on vuorokausi: hitaampi keruu näkyy silti päivien summana. */
const WINDOW_HOURS = 24

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

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString()

    const { data: events, error } = await supabase
      .from("analytics_events")
      .select("user_id, project_id, event_type")
      .eq("event_type", "project_open")
      .gte("created_at", since)

    if (error) throw error

    /*
     * Ylläpitäjä rajataan pois: hän selaa hankkeita työkseen ja näyttäisi
     * aina eniten poikkeavalta. Sama rajaus kuin analytiikkanäkymässä.
     */
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const { data: profiles } = await supabase.from("profiles").select("id, email")

    const adminIds = new Set(
      (profiles ?? [])
        .filter((p: any) => adminEmails.includes(String(p.email ?? "").toLowerCase()))
        .map((p: any) => p.id)
    )

    const emailById = new Map((profiles ?? []).map((p: any) => [p.id, p.email]))

    const distinctByUser = new Map<string, Set<string>>()

    for (const e of events ?? []) {
      const userId = (e as any).user_id
      const projectId = (e as any).project_id

      if (!userId || !projectId || adminIds.has(userId)) continue

      if (!distinctByUser.has(userId)) distinctByUser.set(userId, new Set())
      distinctByUser.get(userId)!.add(projectId)
    }

    const flagged = Array.from(distinctByUser.entries())
      .filter(([, projects]) => projects.size >= DISTINCT_PROJECTS_THRESHOLD)
      .map(([userId, projects]) => ({
        userId,
        email: emailById.get(userId) ?? userId,
        distinctProjects: projects.size,
      }))
      .sort((a, b) => b.distinctProjects - a.distinctProjects)

    if (!flagged.length) {
      return NextResponse.json({
        ok: true,
        flagged: 0,
        threshold: DISTINCT_PROJECTS_THRESHOLD,
        usersChecked: distinctByUser.size,
      })
    }

    const resendKey = process.env.RESEND_API_KEY
    let emailed = false

    if (resendKey) {
      const resend = new Resend(resendKey)

      const lines = flagged.map(
        (f) => `${f.email}: ${f.distinctProjects} eri hanketta ${WINDOW_HOURS} h aikana`
      )

      const sendRes = await resend.emails.send({
        from: process.env.MAIL_FROM || "onboarding@resend.dev",
        to: "info@tyomaat.fi",
        subject: `Poikkeavaa käyttöä: ${flagged.length} tunnusta`,
        text:
          `Seuraavat tunnukset ylittivät kynnyksen ` +
          `(${DISTINCT_PROJECTS_THRESHOLD} eri hanketta / ${WINDOW_HOURS} h):\n\n` +
          `${lines.join("\n")}\n\n` +
          `Vertailu: tavallinen asiakas avaa noin 6 eri hanketta, ` +
          `innokkain mitattu 43.\n\n` +
          `Tämä on ilmoitus, ei toimenpide. Tunnuksen voi lukita ` +
          `osoitteessa /dashboard/users.\n`,
      })

      if ((sendRes as any)?.error) {
        console.error("USAGE ALERT SEND ERROR:", (sendRes as any).error)
      } else {
        emailed = true
      }
    }

    return NextResponse.json({
      ok: true,
      flagged: flagged.length,
      threshold: DISTINCT_PROJECTS_THRESHOLD,
      usersChecked: distinctByUser.size,
      emailed,
      users: flagged,
    })
  } catch (err: any) {
    console.error("USAGE ALERT ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
