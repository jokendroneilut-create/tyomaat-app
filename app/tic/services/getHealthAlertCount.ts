import { createClient } from "@supabase/supabase-js"

import { onRikki } from "@/lib/agent/discovery/lahteenTila"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type HealthAlert = {
  /* Lähteet joiden viimeisin ajo kaatui (alle viikko sitten). */
  rikkiLahteita: number
  /* Koko putken kaatumiset viimeisen 24 h aikana. */
  putkenVirheita: number
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
 * Best-effort: virhe ei saa kaataa TIC-layoutia, joten epäonnistunut
 * haku palauttaa nollan.
 */
export async function getHealthAlertCount(): Promise<HealthAlert> {
  const vrk = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [lahteet, putki] = await Promise.all([
    supabaseAdmin.from("discovery_sources").select("enabled, last_error_at, last_success_at"),
    supabaseAdmin
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "error")
      .gte("started_at", vrk),
  ])

  const nyt = Date.now()

  return {
    rikkiLahteita: lahteet.error ? 0 : (lahteet.data ?? []).filter((s) => onRikki(s, nyt)).length,
    putkenVirheita: putki.error ? 0 : putki.count ?? 0,
  }
}
