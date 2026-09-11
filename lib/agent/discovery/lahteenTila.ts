/*
 * ONKO LÄHDE RIKKI? YKSI SÄÄNTÖ, KOLMEN KOPION SIJAAN.
 *
 * Sääntö oli kirjoitettu kolmeen paikkaan, ja kopiot olivat ehtineet
 * erota: Keräimet-sivu jätti yli viikon vanhat virheet "ongelmien"
 * ulkopuolelle, mutta päivän yhteenveto ei. Sama tilanne näkyi siis
 * kahtena eri lukuna.
 *
 * Health-merkki (sivupalkki) luki kolmatta asiaa kokonaan:
 * `agent_runs`-taulun virheitä. Lähteen kaatuminen kirjataan kuitenkin
 * `discovery_runs`iin, ja koko cron-kutsu merkitään silti onnistuneeksi.
 * Mitattu 11.9.2026: viikossa 400/400 `agent_runs`-ajoa onnistui, vaikka
 * lähteitä kaatui seitsemän kertaa ja rikki oli seitsemän. Merkki ei
 * siis voinut syttyä lähdeviasta, vaikka juuri se oli sen tarkoitus
 * (D-185).
 */

export type LahteenTila = "failing" | "stale" | "disabled" | "ok"

export type LahdeRivi = {
  enabled?: boolean | null
  last_error_at?: string | null
  last_success_at?: string | null
}

/*
 * VIRHEELLÄ ON TUOREUS.
 *
 * Aiemmin mikä tahansa kirjattu virhe teki lähteestä rikkinäisen niin
 * kauan kuin uutta onnistumista ei tullut. Kertaluontoinen katko jäi
 * siis näkyviin viikoiksi ja hukutti aidot viat alleen - mitattu
 * 14.8.2026: 13 punaista, joista yksi oli aito.
 *
 * Yli viikon vanha virhe on oma tilansa eikä lasketa "ongelmiin". Sitä
 * ei piiloteta, koska korjaamaton vanha virhe on silti tieto.
 */
export const VIRHEEN_TUOREUS_MS = 7 * 24 * 60 * 60 * 1000

export function lahteenTila(lahde: LahdeRivi, nyt: number = Date.now()): LahteenTila {
  if (!lahde.enabled) return "disabled"

  const virhe = lahde.last_error_at ? new Date(lahde.last_error_at).getTime() : null
  const onnistui = lahde.last_success_at ? new Date(lahde.last_success_at).getTime() : null

  if (virhe != null && Number.isFinite(virhe) && (onnistui == null || virhe > onnistui)) {
    return nyt - virhe > VIRHEEN_TUOREUS_MS ? "stale" : "failing"
  }
  return "ok"
}

/*
 * Rikki = viimeisin tapahtuma on virhe, ja se on alle viikon vanha.
 *
 * PUNAINEN EI TARKOITA "RIKKI NYT". Lippu putoaa vasta onnistuneesta
 * ajosta, ei siitä että vika on korjattu (ks. 04_ROADMAP). Lähde tulee
 * vuoroon noin viiden päivän välein, joten yksittäinen palvelinjumi
 * pitää sen punaisena niin kauan - ellei sitä aja käsin.
 */
export function onRikki(lahde: LahdeRivi, nyt: number = Date.now()): boolean {
  return lahteenTila(lahde, nyt) === "failing"
}
