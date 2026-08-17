import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

/*
 * TUNNUKSEN LUKITUS JA VAPAUTUS.
 *
 * MIKSI TÄMÄ ON OLEMASSA. Tunnukselle ei ollut aiemmin yhtään toimenpidettä
 * paitsi KOVA POISTO (`/api/admin/delete-user`). Jos väärinkäyttö havaittiin,
 * ainoa vipu oli tuhota tili lopullisesti — jolloin katosivat myös todisteet
 * eikä virhettä voinut perua.
 *
 * Lukitus estää kirjautumisen mutta säilyttää tilin, sen historian ja
 * analytiikkatapahtumat. Sama periaate kuin hankkeiden piilotuksessa
 * (D-080): peruttava toimenpide ennen peruuttamatonta, ja perustelu talteen.
 *
 * TOTEUTUS. Supaben `ban_duration` on tekstikenttä ("876000h" = 100 vuotta,
 * "none" purkaa). Se ei ole erillinen tila-sarake, joten lukituksen syy ei
 * mahdu siihen — syy kirjataan `account_lifecycle`-päiväkirjaan, joka on jo
 * olemassa tilitapahtumia varten.
 */

/* Käytännössä pysyvä. Lukitus puretaan käsin, ei ajastimella. */
const LOCK_DURATION = "876000h"
const UNLOCK_DURATION = "none"

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
    const lock = body.lock !== false
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    if (!userId) {
      return NextResponse.json({ error: "userId missing" }, { status: 400 })
    }

    /*
     * Perustelu on PAKOLLINEN lukittaessa muttei vapautettaessa. Lukitus on
     * päätös, ja perustelematon päätös on seuraavalle katsojalle arvoitus;
     * virheen korjaamisen taas pitää olla helpompaa kuin sen tekemisen.
     */
    if (lock && !reason) {
      return NextResponse.json(
        { error: "Lukitseminen vaatii perustelun (reason)" },
        { status: 400 }
      )
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

    /* Oman tunnuksen lukitseminen sulkisi ulos koko ylläpidon. */
    if (userId === caller.id) {
      return NextResponse.json(
        { error: "et voi lukita omaa tunnustasi" },
        { status: 400 }
      )
    }

    const { data: target } = await supabase.auth.admin.getUserById(userId)

    if (!target?.user) {
      return NextResponse.json({ error: "käyttäjää ei löydy" }, { status: 404 })
    }

    /* Toisen ylläpitäjän lukitseminen on lähes varmasti vahinko. */
    if (admins.includes((target.user.email || "").toLowerCase())) {
      return NextResponse.json(
        { error: "ylläpitäjän tunnusta ei voi lukita tästä" },
        { status: 400 }
      )
    }

    /*
     * TILA KIRJATAAN MYÖS `app_metadata`an.
     *
     * `ban_duration` estää kirjautumisen, mutta se ei kanna PERUSTELUA
     * eikä lukitusaikaa — ja juuri perustelu on se mitä seuraava katsoja
     * tarvitsee ("miksi tämä on lukossa?"). `app_metadata` palautuu
     * `listUsers`issa ja on vain palvelimelta kirjoitettavissa, joten se
     * on turvallinen paikka näytettävälle tilalle.
     *
     * HUOM. Älä päättele kentän puuttumisesta ettei sitä ole:
     * supabase-js jättää null-kentät kokonaan pois oliosta, joten yhden
     * käyttäjän otos näyttää harhaanjohtavasti siltä että kenttää ei ole
     * olemassa. Todettu 18.8.2026 sekä `last_sign_in_at`in (löytyy 54/76
     * käyttäjältä) että `banned_until`in kohdalla.
     */
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: lock ? LOCK_DURATION : UNLOCK_DURATION,
      app_metadata: {
        ...(target.user.app_metadata ?? {}),
        locked: lock,
        locked_at: lock ? new Date().toISOString() : null,
        locked_reason: lock ? reason : null,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    /*
     * Kirjaus ei saa kaataa toimenpidettä: lukitus on turvatoimi, loki on
     * meidän kirjanpitoamme. Sama sääntö kuin poistoreitillä.
     */
    try {
      /*
       * UPSERT, EI INSERT. `account_lifecycle`-taulussa on uniikkirajoite
       * (user_id, event), joten saman tunnuksen toinen lukitus olisi
       * kaatunut duplikaattivirheeseen — ja koska kirjaus on try/catchin
       * sisällä, lukitus olisi silti onnistunut mutta jäänyt kirjaamatta.
       * Juuri se tieto olisi kadonnut, jota varten loki on olemassa.
       *
       * RAJOITE JÄÄ: taulu säilyttää yhden rivin per (tunnus, tapahtuma),
       * eli VIIMEISIMMÄN lukituksen syineen — ei koko lukitushistoriaa.
       * Täysi historia vaatisi rajoitteen muuttamisen käsin SQL-editorissa.
       */
      const { error: logError } = await supabase.from("account_lifecycle").upsert(
        {
          user_id: userId,
          email: target.user.email ?? null,
          event: lock ? "locked" : "unlocked",
          occurred_at: new Date().toISOString(),
          metadata: {
            source: "admin_lock_user",
            by: caller.email ?? null,
            ...(lock ? { reason } : {}),
          },
        },
        { onConflict: "user_id,event" }
      )

      if (logError) {
        console.error("ACCOUNT LIFECYCLE LOG FAILED:", logError.message)
      }
    } catch (logErr: any) {
      console.error("ACCOUNT LIFECYCLE LOG FAILED:", logErr?.message ?? logErr)
    }

    return NextResponse.json({ ok: true, userId, locked: lock })
  } catch (err: any) {
    console.error("LOCK USER ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}
