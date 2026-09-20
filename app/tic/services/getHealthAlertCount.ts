import { createClient } from "@supabase/supabase-js"

import { onRikki } from "@/lib/agent/discovery/lahteenTila"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* Yksi rikkinäinen lähde siinä muodossa kuin Health-sivu sen näyttää. */
export type RikkiLahde = {
  id: string
  name: string
  /* Viimeisin virheviesti sellaisenaan - se on koko syy, ei tiivistelmä. */
  lastErrorMessage: string | null
  lastErrorAt: string | null
  lastSuccessAt: string | null
}

export type HealthAlert = {
  /* Lähteet joiden viimeisin ajo kaatui (alle viikko sitten). */
  rikkiLahteita: number
  /* Koko putken kaatumiset viimeisen 24 h aikana. */
  putkenVirheita: number
  /* Samat lähteet nimeltä, jotta syy näkyy ilman erillistä hakua. */
  rikkinaiset: RikkiLahde[]
  /* Merkin luku: molemmat syyt yhteen laskettuna. */
  yhteensa: number
}

/*
 * SIVUPALKIN HEALTH-MERKKI (D-185).
 *
 * Merkki luki aiemmin vain `agent_runs`-taulun virheitä. Ne syntyvät
 * ainoastaan kun koko cron-kutsu kaatuu, ja lähdekohtaiset kaatumiset
 * menevät `discovery_runs`iin — putki itse merkitään onnistuneeksi.
 * Mitattu 11.9.2026: 400/400 putkiajoa onnistui viikossa, mutta
 * seitsemän lähdettä oli rikki. Merkki oli siis sokea juuri sille
 * mitä sen piti näyttää.
 *
 * NYT MOLEMMAT. Putken kaatuminen on edelleen tärkeä tieto eikä näy
 * lähteiden tilassa, joten sitä ei pudoteta pois — merkki kertoo
 * summan ja otsikkoteksti erittelee.
 *
 * RIKKI-SÄÄNTÖ ON SAMA KUIN KERÄIMET-SIVULLA (`lahteenTila`), jotta
 * merkki ja sivun "ongelmia N" eivät koskaan näytä eri lukua.
 *
 * LÄHTEET PALAUTETAAN NIMELTÄ (20.9.2026). Merkki oli pelkkä "!" ja syy
 * pelkässä title-attribuutissa, eli se aukesi vain hiirtä paikallaan
 * pitämällä - ja Health-sivu, jonne merkki vie, ei näyttänyt
 * rikkinäisiä lähteitä lainkaan. Merkki siis kertoi että jokin on
 * vialla mutta ei mikä, eikä sivu vastannut kysymykseen. Nimet ja
 * virheviesti haetaan samalla kyselyllä kuin luku, joten sivun ja
 * merkin on mahdotonta erota toisistaan.
 *
 * Best-effort: virhe ei saa kaataa TIC-layoutia, joten epäonnistunut
 * haku palauttaa nollan.
 */
export async function getHealthAlertCount(): Promise<HealthAlert> {
  const vrk = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [lahteet, putki] = await Promise.all([
    supabaseAdmin
      .from("discovery_sources")
      .select(
        "id, name, enabled, last_error_at, last_success_at, last_error_message"
      ),
    supabaseAdmin
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "error")
      .gte("started_at", vrk),
  ])

  const nyt = Date.now()

  const rikkinaiset: RikkiLahde[] = lahteet.error
    ? []
    : (lahteet.data ?? [])
        .filter((s) => onRikki(s, nyt))
        /* Tuorein virhe ensin: se on se jota ei vielä ehditty katsoa. */
        .sort((a, b) =>
          String(b.last_error_at ?? "").localeCompare(String(a.last_error_at ?? ""))
        )
        .map((s) => ({
          id: String(s.id),
          name: String(s.name),
          lastErrorMessage: s.last_error_message ?? null,
          lastErrorAt: s.last_error_at ?? null,
          lastSuccessAt: s.last_success_at ?? null,
        }))

  const putkenVirheita = putki.error ? 0 : putki.count ?? 0

  return {
    rikkiLahteita: rikkinaiset.length,
    putkenVirheita,
    rikkinaiset,
    yhteensa: rikkinaiset.length + putkenVirheita,
  }
}

/*
 * YKSI LAUSE, KAKSI PAIKKAA.
 *
 * Sivupalkin merkki ja Health-sivun otsikko kertovat saman asian, ja
 * ennen tätä ne kertoivat sen eri sanoin: merkin title-teksti puhui
 * "lähteistä rikki", sivu ei puhunut niistä mitään. Kun sanamuoto on
 * yhdessä funktiossa, kahta versiota ei voi syntyä - sama syy kuin
 * `lahteenTila`-säännön keskittämisessä.
 */
export function kuvaaHealthHalytys(alert: HealthAlert): string {
  if (alert.yhteensa === 0) return "Ei havaittuja ongelmia"

  const osat: string[] = []

  if (alert.rikkiLahteita > 0) {
    /* Yksikkö erikseen: "1 lähdettä rikki" on juuri se luettavuusvirhe
     * jonka takia lukua ei aiemmin uskallettu näyttää merkissä. */
    const sana = alert.rikkiLahteita === 1 ? "lähde" : "lähdettä"
    osat.push(
      `${alert.rikkiLahteita} ${sana} rikki (viimeisin ajo kaatui, alle viikko sitten)`
    )
  }

  if (alert.putkenVirheita > 0) {
    const sana = alert.putkenVirheita === 1 ? "kaatuminen" : "kaatumista"
    osat.push(`${alert.putkenVirheita} putken ${sana} 24 h`)
  }

  return osat.join(", ")
}
