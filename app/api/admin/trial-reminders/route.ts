import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { isAccountLocked } from "@/lib/auth/isAccountLocked"
import { asiakkaanTunniste } from "@/lib/users/asiakastunniste"
import { parseAdminEmails, resolveRole } from "@/lib/auth/roles"
import {
  valitseMuistutettavat,
  muistutuksenOtsikko,
  muistutuksenTeksti,
  type MuistutusEhdokas,
} from "@/lib/users/trialMuistutukset"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * KOKEILUJAKSON MUISTUTUKSET (D-340).
 *
 * Yksi reitti kaikille kolmelle viestille: ero on vain rajapyykissa,
 * jonka `valitseMuistutettavat` paattaa. Kolme reittia olisi kolme
 * paikkaa jossa ehto voi erkaantua.
 *
 * Valinta on puhtaassa funktiossa (`lib/users/trialMuistutukset.ts`),
 * joten saannot testataan ilman kantaa ja ilman sahkopostia. Tama reitti
 * hoitaa vain haun, lahetyksen ja lokin.
 *
 *   GET ?secret=CRON_SECRET&dry=1   listaa saajat lahettamatta
 *   GET ?secret=CRON_SECRET&test=1  lahettaa vain TEST_EMAILiin
 *   Cron: Authorization: Bearer CRON_SECRET
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")
    const dry = url.searchParams.get("dry") === "1"
    const test = url.searchParams.get("test") === "1"

    const isManual = !!secret && secret === process.env.CRON_SECRET
    const isCron = !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isManual && !isCron) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const appBaseUrl = process.env.APP_BASE_URL || "https://app.tyomaat.fi"

    /* 1. Kaikki tunnukset. Ika luetaan auth.usersista, ei profiilista. */
    const kayttajat: any[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      kayttajat.push(...(data?.users ?? []))
      if ((data?.users ?? []).length < 200) break
    }

    /*
     * 2. Laskutustila on ASIAKKAALLA, ei tunnuksella: avain on valittu
     * yritys, muuten domain tai vapaa sahkoposti (D-223, D-224).
     */
    const { data: laskutusrivit } = await supabase
      .from("customer_billing")
      .select("tunniste,tila")
    const tilat = new Map(
      (laskutusrivit ?? []).map((r: any) => [String(r.tunniste).toLowerCase(), r.tila])
    )

    const { data: yritysrivit } = await supabase.from("user_company").select("user_id,yritys")
    const yritykset = new Map((yritysrivit ?? []).map((r: any) => [r.user_id, r.yritys]))

    const { data: profiilit } = await supabase.from("profiles").select("id,first_name")
    const etunimet = new Map((profiilit ?? []).map((r: any) => [r.id, r.first_name]))

    /*
     * Rooli on omassa taulussaan, ja ADMIN_EMAILS voittaa sen
     * (`resolveRole`). Molemmat tarvitaan: admin voi olla pelkan
     * ymparistomuuttujan varassa ilman kantariviä.
     */
    const { data: roolirivit } = await supabase.from("user_roles").select("user_id,role")
    const kantaroolit = new Map((roolirivit ?? []).map((r: any) => [r.user_id, r.role]))
    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

    /*
     * 3. Jo kasitellyt rajapyykit. Puuttuva taulu ei saa kaataa ajoa
     * hiljaa vaan nakyvasti: ilman lokia tupla olisi mahdollinen, joten
     * tassa pysahdytaan.
     */
    const { data: lokirivit, error: lokiVirhe } = await supabase
      .from("trial_reminder_log")
      .select("user_id,virstanpylvas")
    if (lokiVirhe) {
      return NextResponse.json(
        { error: `trial_reminder_log: ${lokiVirhe.message}` },
        { status: 500 }
      )
    }
    const kasitellyt = new Map<string, number[]>()
    for (const r of lokirivit ?? []) {
      const lista = kasitellyt.get((r as any).user_id) ?? []
      lista.push(Number((r as any).virstanpylvas))
      kasitellyt.set((r as any).user_id, lista)
    }

    const ehdokkaat: MuistutusEhdokas[] = kayttajat.map((u) => ({
      userId: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      etunimi: etunimet.get(u.id) ?? null,
      tila: tilat.get(asiakkaanTunniste(u.email, yritykset.get(u.id))) ?? null,
      lukittu: isAccountLocked(u),
      rooli: resolveRole({
        email: u.email,
        dbRole: kantaroolit.get(u.id) ?? null,
        adminEmails,
      }),
      kasitellyt: kasitellyt.get(u.id) ?? [],
    }))

    const valitut = valitseMuistutettavat(ehdokkaat)

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        tunnuksia: kayttajat.length,
        lahetettavia: valitut.length,
        saajat: valitut.map((m) => ({
          email: m.email,
          virstanpylvas: m.virstanpylvas,
          paiviaJaljella: m.paiviaJaljella,
          vanhentuneet: m.vanhentuneet,
          otsikko: muistutuksenOtsikko(m.paiviaJaljella),
        })),
      })
    }

    const fromEmail = process.env.MAIL_FROM
    if (!fromEmail) {
      return NextResponse.json({ error: "MAIL_FROM missing" }, { status: 500 })
    }
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 })
    }
    const resend = new Resend(resendKey)

    let lahetetty = 0
    let ohitettu = 0
    const virheet: string[] = []

    for (const m of valitut) {
      const { text, html } = muistutuksenTeksti(m.etunimi, m.paiviaJaljella, appBaseUrl)

      /*
       * Testiajossa viesti menee vain omaan osoitteeseen EIKA lokiin:
       * muuten testi kuluttaisi asiakkaan oikean rajapyykin.
       */
      const vastaanottaja = test ? adminEmails[0] || fromEmail : m.email

      const tulos = await resend.emails.send({
        from: fromEmail,
        to: vastaanottaja,
        subject: muistutuksenOtsikko(m.paiviaJaljella),
        text,
        html,
      })

      const virhe = (tulos as any)?.error
      if (virhe) {
        virheet.push(`${m.email}: ${virhe.message ?? "send failed"}`)
        continue
      }

      lahetetty += 1
      if (test) continue

      const rivit: Record<string, unknown>[] = [
        {
          user_id: m.userId,
          email: m.email,
          virstanpylvas: m.virstanpylvas,
          paivia_jaljella: m.paiviaJaljella,
          tila: "lahetetty",
          /*
           * Teksti talteen sellaisena kuin se LAHTI. Sen voisi rakentaa
           * uudelleen lokin luvuista, mutta silloin nakyma nayttaisi
           * nykyisen sanamuodon eika sita joka asiakkaalle meni -- ja
           * teksti on jo muuttunut kahdesti. Loki on tosite, ei
           * esikatselu ([[newer-source-is-not-current-state]]).
           */
          otsikko: muistutuksenOtsikko(m.paiviaJaljella),
          viesti: text,
        },
        ...m.vanhentuneet.map((v) => ({
          user_id: m.userId,
          email: m.email,
          virstanpylvas: v,
          paivia_jaljella: m.paiviaJaljella,
          tila: "ohitettu",
        })),
      ]
      ohitettu += m.vanhentuneet.length

      /*
       * VARAREITTI KUNNES DDL ON AJETTU. Tekstisarakkeet lisataan kasin
       * (`docs/sql/2026-10-24_trial_reminder_viesti.sql`). Jos koodi
       * ehtii tuotantoon ensin, koko kirjaus epaonnistuisi ja ajo
       * pysahtyisi -- joten ilman sarakkeita kirjataan samat rivit
       * ilman tekstia. Sama kaytanto kuin profiilin puhelinsarakkeella
       * (D-238).
       */
      let { error } = await supabase.from("trial_reminder_log").insert(rivit)
      if (error && /otsikko|viesti/.test(error.message)) {
        const ilmanTekstia = rivit.map((r: Record<string, unknown>) => {
          const { otsikko, viesti, ...muut } = r
          return muut
        })
        ;({ error } = await supabase.from("trial_reminder_log").insert(ilmanTekstia))
      }
      if (error) {
        /*
         * KIRJAUKSEN EPAONNISTUMINEN PYSAYTTAA AJON.
         *
         * Viesti on jo lahtenyt, ja ilman lokiriviä se lahtisi huomenna
         * uudelleen -- joka paiva. Mitattu 24.10.2026: `check`-rajoite
         * salli vain arvot 7, 14 ja 21, joten paattymisviesti (0) olisi
         * lahtenyt ja jaanyt kirjaamatta. Yksi toistuva viesti on paha,
         * kymmenen on pahempi, joten loput jaavat huomiseen.
         */
        virheet.push(`LOKI ${m.email}: ${error.message}`)
        break
      }
    }

    return NextResponse.json({
      ok: true,
      test,
      tunnuksia: kayttajat.length,
      lahetettavia: valitut.length,
      lahetetty,
      ohitettuVanhentuneena: ohitettu,
      virheita: virheet.length,
      virheet: virheet.slice(0, 10),
    })
  } catch (err: any) {
    console.error("TRIAL REMINDERS ERROR:", err)
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 })
  }
}
