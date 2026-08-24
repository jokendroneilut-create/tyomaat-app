/*
 * TYÖTILAISUUSHÄLYTYKSEN AIKAIKKUNA.
 *
 * Kiinteä 30 tunnin ikkuna taaksepäin nykyhetkestä tuottaa PYSYVÄN
 * KATVEEN aina kun yksikin ajo jää väliin. Mitattu 24.8.2026, kun
 * Supabase oli alhaalla 15 tuntia:
 *
 *   eilinen ajo   23.8. 08:00  kattoi  22.8. 02:00 -> 23.8. 08:00
 *   tämän päivän  24.8. 08:00  EI AJETTU
 *   huominen      25.8. 08:00  kattaa  24.8. 02:00 -> 25.8. 08:00
 *                                      ^ väliin jää 18 tuntia
 *
 * Katveeseen jäi 54 vaihemuutosta ja 71 hankeilmoitusta kahdeksalle
 * maksavalle asiakkaalle. Ne piti lähettää käsin, eikä niitä olisi
 * huomattu ilman erillistä selvitystä.
 *
 * KORJAUS on vesiraja: ikkuna alkaa siitä mihin edellinen ajo pääsi,
 * ei nykyhetkestä taaksepäin. Sama periaate kuin hakuvahdin
 * `last_sent_at`-leimassa, joka selvisi samasta katkosta ilman menetyksiä.
 *
 * KOLME RAJAUSTA:
 *
 *   1. `?hours=N` ohittaa vesirajan. Käsin ajettava korjaus on pidettävä
 *      mahdollisena — sillä katve paikattiin 24.8.
 *   2. Katto taaksepäin. Kuukauden katko ei saa tuottaa kuukauden
 *      ikäisiä "juuri nyt alkoi" -ilmoituksia; vanha liidi on huonompi
 *      kuin ei liidiä, koska se syö uskottavuuden.
 *   3. Vesiraja siirtyy vain oikeassa ajossa, ei `dry=1`-esikatselussa.
 *
 * Tuplia ei tarvitse pelätä: `opportunity_alerts` on uniikki
 * (user_id, project_id, phase_key), joten leveämpi ikkuna ei voi
 * lähettää samaa kahdesti. Siksi vesirajan saa asettaa varovasti
 * taaksepäin.
 */

export const DEFAULT_WINDOW_HOURS = 30

/* Viikkoa vanhempi vaihemuutos ei ole enää uutinen. */
export const MAX_LOOKBACK_HOURS = 7 * 24

export type WindowSource =
  /* ?hours=N annettu käsin */
  | "override"
  /* edellisen ajon vesiraja */
  | "watermark"
  /* vesiraja liian vanha -> katkaistu kattoon */
  | "clamped"
  /* ei vesirajaa (ensimmäinen ajo tai taulu puuttuu) */
  | "fallback"

export type ResolvedWindow = {
  since: Date
  source: WindowSource
  /* Kuinka pitkälle taakse ikkuna ulottuu — raportointia varten. */
  hours: number
}

export function resolveWindow(opts: {
  now: number
  overrideHours?: number | null
  watermark?: string | null
}): ResolvedWindow {
  const { now } = opts
  const kattoAlku = now - MAX_LOOKBACK_HOURS * 3600_000

  const kuvaa = (since: Date, source: WindowSource): ResolvedWindow => ({
    since,
    source,
    hours: Math.round(((now - since.getTime()) / 3600_000) * 10) / 10,
  })

  /*
   * Kelvoton arvo (0, negatiivinen, NaN) EI ole yhden tunnin ikkuna vaan
   * "ei annettu": ?hours=0 tarkoittaa kirjoitusvirhetta, ja siita
   * seuraava minuuttien ikkuna hukkaisi hiljaa kaiken muun.
   */
  if (opts.overrideHours != null && Number.isFinite(opts.overrideHours) && opts.overrideHours > 0) {
    return kuvaa(new Date(now - opts.overrideHours * 3600_000), "override")
  }

  if (opts.watermark) {
    const t = Date.parse(opts.watermark)
    if (Number.isFinite(t)) {
      /*
       * Tulevaisuudessa oleva vesiraja tarkoittaisi kellon siirtymää.
       * Ei skannata mitään mieluummin kuin skannattaisiin väärin.
       */
      if (t > now) return kuvaa(new Date(now), "watermark")
      if (t < kattoAlku) return kuvaa(new Date(kattoAlku), "clamped")
      return kuvaa(new Date(t), "watermark")
    }
  }

  return kuvaa(new Date(now - DEFAULT_WINDOW_HOURS * 3600_000), "fallback")
}
