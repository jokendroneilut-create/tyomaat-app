/*
 * TESTITUNNUKSEN KESTO.
 *
 * Suurin osa tunnuksista on kokeilukäyttäjiä, eikä tilaus- tai
 * kokeilutilaa kerätä mihinkään — se on tietoinen valinta, koska
 * laskutus hoidetaan käsin. Siksi ainoa asia josta kokeilun päättymisen
 * voi päätellä on tunnuksen ikä.
 *
 * Ikä lasketaan `auth.users.created_at`-kentästä. `profiles.created_at`
 * EI kelpaa: se ei ole tilin luontipäivä.
 *
 * LASKENTA ALKAA TUNNUKSEN LUONNISTA, ei ensimmäisestä kirjautumisesta.
 * Vahvistettu 23.8.2026. Seuraus on tiedostettu: tunnus jonka saaja ei
 * ole koskaan kirjautunut näkyy silti päättyneenä 30 päivän jälkeen —
 * kokeilu on annettu, käyttämättä jättäminen ei pidennä sitä.
 */

export const TRIAL_DAYS = 30

/* Viikko ennen päättymistä riittää varoitukseksi. */
export const TRIAL_WARNING_DAYS = 7

export type TrialState = "ohi" | "pian" | "kesken"

/*
 * Montako täyttä päivää tunnuksen luonnista. `now` on parametri, jotta
 * testit eivät riipu kellonajasta.
 */
export function daysSince(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null

  const luotu = new Date(value).getTime()
  if (!Number.isFinite(luotu)) return null

  /* Tulevaisuuden aikaleima on virhe datassa, ei negatiivinen ikä. */
  const ms = now - luotu
  if (ms < 0) return 0

  return Math.floor(ms / 86400000)
}

/*
 * Kolme tilaa, jotta pian päättyvät erottuvat jo päättyneistä. Pelkkä
 * "ohi/kesken" ei auttaisi ennakoimaan, ja juuri ennakointi on tämän
 * näkymän tarkoitus.
 */
export function trialState(days: number | null): TrialState {
  if (days == null) return "kesken"
  if (days >= TRIAL_DAYS) return "ohi"
  if (days >= TRIAL_DAYS - TRIAL_WARNING_DAYS) return "pian"
  return "kesken"
}

export function daysLeft(days: number | null): number | null {
  if (days == null) return null
  return Math.max(0, TRIAL_DAYS - days)
}
