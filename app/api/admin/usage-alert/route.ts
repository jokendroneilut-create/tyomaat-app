import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

import { omanKaytonEmails, omanKaytonIds } from "@/lib/analytics/omaKaytto"

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

/*
 * TOINEN SIGNAALI: SIVULATAUKSET.
 *
 * Hankeavausten laskeminen ei nae listasivun keruuta lainkaan. Hankelista
 * lataa koko aineiston kahdeksalla pyynnolla (D-281), joten tuhansien
 * hankkeiden tiedot saa avaamatta yhtaan hanketta — ja juuri silloin
 * ylla oleva kynnys pysyy nollassa.
 *
 * Johannes 14.10.2026: *"600-700 luettua sivua paivassa on jo sellainen
 * maara etta siita olisi hyva tulla ilmoitus, jopa paljon pienemmasta."*
 *
 * Perustaso mitattu samana paivana 60 vuorokauden ajalta, oma kaytto pois
 * (291 kayttaja-paivaa):
 *
 *   mediaani 12 sivua/vrk · 90 % alle 52 · 95 % alle 85 · 99 % alle 268
 *
 * Kynnys 150 osuu noin 4-5 kertaa kuukaudessa. Se on tarkoituksella
 * matalampi kuin hankeavausten kynnys: tama on ILMOITUS eika lukitus,
 * ja vaara ilmoitus maksaa yhden silmayksen. Liian korkea kynnys sen
 * sijaan tarkoittaa, ettei kerays nay lainkaan.
 */
const PAGEVIEW_THRESHOLD = 150

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

    /*
     * SIVUTETTU. PostgREST palauttaa enintaan 1 000 riviä, ja pelkkia
     * sivulatauksia on vilkkaana vuorokautena 1 375 (mitattu 14.10.2026).
     * Katkaistu kysely olisi laskenut nimenomaan vilkkaimman kayttajan
     * alakanttiin — eli sen jonka takia halytys on olemassa.
     */
    const events: { user_id: string | null; project_id: string | null; event_type: string }[] = []

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("user_id, project_id, event_type")
        .in("event_type", ["project_open", "pageview"])
        .gte("created_at", since)
        .range(from, from + 999)

      if (error) throw error
      if (!data?.length) break
      events.push(...(data as any[]))
      if (data.length < 1000) break
    }

    /*
     * Ylläpitäjä rajataan pois: hän selaa hankkeita työkseen ja näyttäisi
     * aina eniten poikkeavalta. Sama rajaus kuin analytiikkanäkymässä —
     * myös ylläpitäjän muut tunnukset (D-204).
     */
    const { data: profiles } = await supabase.from("profiles").select("id, email")
    const { data: roolit } = await supabase.from("user_roles").select("user_id, role")

    const adminIds = omanKaytonIds({
      users: profiles ?? [],
      roolit,
      emails: omanKaytonEmails(process.env),
    })

    const emailById = new Map((profiles ?? []).map((p: any) => [p.id, p.email]))

    const distinctByUser = new Map<string, Set<string>>()
    const pageviewsByUser = new Map<string, number>()

    for (const e of events) {
      const userId = e.user_id
      if (!userId || adminIds.has(userId)) continue

      if (e.event_type === "pageview") {
        pageviewsByUser.set(userId, (pageviewsByUser.get(userId) ?? 0) + 1)
        continue
      }

      if (!e.project_id) continue
      if (!distinctByUser.has(userId)) distinctByUser.set(userId, new Set())
      distinctByUser.get(userId)!.add(e.project_id)
    }

    const kaikkiTunnukset = new Set([...distinctByUser.keys(), ...pageviewsByUser.keys()])

    const flagged = Array.from(kaikkiTunnukset)
      .map((userId) => ({
        userId,
        email: emailById.get(userId) ?? userId,
        distinctProjects: distinctByUser.get(userId)?.size ?? 0,
        pageviews: pageviewsByUser.get(userId) ?? 0,
      }))
      .filter(
        (f) =>
          f.distinctProjects >= DISTINCT_PROJECTS_THRESHOLD ||
          f.pageviews >= PAGEVIEW_THRESHOLD
      )
      .sort((a, b) => b.pageviews - a.pageviews || b.distinctProjects - a.distinctProjects)

    if (!flagged.length) {
      return NextResponse.json({
        ok: true,
        flagged: 0,
        thresholds: {
          pageviews: PAGEVIEW_THRESHOLD,
          distinctProjects: DISTINCT_PROJECTS_THRESHOLD,
        },
        usersChecked: kaikkiTunnukset.size,
      })
    }

    const resendKey = process.env.RESEND_API_KEY
    let emailed = false

    if (resendKey) {
      const resend = new Resend(resendKey)

      const lines = flagged.map((f) => {
        const syyt = [
          f.pageviews >= PAGEVIEW_THRESHOLD ? `${f.pageviews} sivua` : null,
          f.distinctProjects >= DISTINCT_PROJECTS_THRESHOLD
            ? `${f.distinctProjects} eri hanketta`
            : null,
        ].filter(Boolean)

        return (
          `${f.email}: ${syyt.join(" ja ")} ${WINDOW_HOURS} h aikana` +
          ` (sivuja ${f.pageviews}, eri hanketta ${f.distinctProjects})`
        )
      })

      const sendRes = await resend.emails.send({
        from: process.env.MAIL_FROM || "onboarding@resend.dev",
        to: "info@tyomaat.fi",
        subject: `Poikkeavaa käyttöä: ${flagged.length} tunnusta`,
        text:
          `Seuraavat tunnukset ylittivät kynnyksen ${WINDOW_HOURS} h aikana\n` +
          `(${PAGEVIEW_THRESHOLD} sivulatausta tai ` +
          `${DISTINCT_PROJECTS_THRESHOLD} eri hanketta):\n\n` +
          `${lines.join("\n")}\n\n` +
          `Vertailu, mitattu 60 vrk ajalta ilman omaa käyttöä:\n` +
          `  sivuja/vrk: mediaani 12, 90 % alle 52, 95 % alle 85\n` +
          `  eri hanketta: tavallinen asiakas noin 6, innokkain 43\n\n` +
          `Sivulataukset ovat mukana siksi, että koko hankelistan saa ` +
          `ladattua avaamatta yhtään hanketta.\n\n` +
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
      thresholds: {
        pageviews: PAGEVIEW_THRESHOLD,
        distinctProjects: DISTINCT_PROJECTS_THRESHOLD,
      },
      usersChecked: kaikkiTunnukset.size,
      emailed,
      users: flagged,
    })
  } catch (err: any) {
    console.error("USAGE ALERT ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
