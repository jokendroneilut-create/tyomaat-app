/*
 * TAPAHTUMA ILMAN KÄYTTÄJÄTUNNISTETTA — MILLOIN SE ON HÄLYTYS?
 *
 * Kirjausreitti (`app/api/analytics/track/route.ts`) ei kirjoita riviä
 * ilman kirjautunutta käyttäjää. Nollarivi ei siis voi syntyä
 * kirjaamisessa, ja D-083 päätteli siitä että nollarivi tarkoittaa
 * tuntematonta kirjoittajaa. Päättely oli oikea silloin ja se toimi:
 * heinäkuun 544 riviä olisi huomattu kuukautta aiemmin.
 *
 * MUTTA PREMISSI VANHENI. D-083 sulki pois kolme selitystä, joista yksi
 * oli "yhtään tiliä ei ole poistettu". 24.8.2026 alkaen kokeilutunnuksia
 * on poistettu, ja `analytics_events.user_id` on `ON DELETE SET NULL`
 * (`docs/sql/2026-08-24_user_cascade.sql`): tapahtuma säilyy tilastossa,
 * henkilöyhteys katkeaa. Poisto siis NOLLAA käyttäjän vanhat rivit.
 *
 * Rivejä ei silloin ole kirjoitettu ilman käyttäjää — ne on kirjoitettu
 * käyttäjän kanssa ja nollattu jälkikäteen. Mitattu 9.9.2026: 20
 * poistettua tunnusta 24.8.-8.9., ja niiden jäljiltä 308 nollariviä
 * viimeisen 30 vrk:n ikkunassa. Rivit olivat tavallista käyttöä
 * (204 pageview, 59 login, 44 project_open) eikä yhtään ollut
 * viimeisimmän poiston jälkeen.
 *
 * MITTARIA EI POISTETA VAAN VAIMENNETAAN ODOTETULLA MÄÄRÄLLÄ. Pysyvä
 * varoitus lakkaa olemasta varoitus, mutta poistettu ilmaisin ei näe
 * mitään. Poistoreitti laskee jatkossa nollattavien rivien määrän ennen
 * poistoa ja kirjaa sen `account_lifecycle`-päiväkirjaan, jolloin
 * hälytys voi verrata toteutunutta odotettuun.
 */

/*
 * LÄHTÖTASO 10.9.2026: kaikki tuolloin kannassa olleet nollarivit.
 *
 * Taaksepäin ei voi laskea. Jo poistetuilta tunnuksilta yhteys on
 * katkennut lopullisesti, joten näiden 1 511 rivin jakautumista
 * heinäkuun RLS-aukon (544) ja 24.8. alkaneiden poistojen kesken ei enää
 * saa selville. Luku on siis "tämä on jo nähty ja selitetty", ei arvio.
 *
 * Vain tämän jälkeiset poistot kirjaavat oman määränsä, joten hälytys
 * seuraa kasvua eikä kertynyttä historiaa.
 */
export const NOLLARIVIEN_LAHTOTASO = 1511

/* Poistoreitin kirjaama kenttä `account_lifecycle.metadata`ssa. */
export const NOLLATTUJEN_KENTTA = "analytics_rows_unlinked"

export type ElinkaariRivi = {
  event?: string | null
  metadata?: Record<string, any> | null
}

/*
 * Kuinka monta nollariviä on selitetty: lähtötaso plus jokainen poisto
 * joka on kirjannut oman määränsä.
 *
 * Ennen 10.9.2026 tehdyillä poistoilla kenttää ei ole, eikä niitä
 * lasketa erikseen — ne sisältyvät jo lähtötasoon. Kentän puuttuminen on
 * siis oikea tapa erottaa vanhat uusista, ei puute.
 */
export function odotetutNollarivit(elinkaari: ElinkaariRivi[]): number {
  let summa = NOLLARIVIEN_LAHTOTASO

  for (const rivi of elinkaari) {
    if (rivi?.event !== "deleted") continue
    const maara = rivi?.metadata?.[NOLLATTUJEN_KENTTA]
    if (typeof maara === "number" && Number.isFinite(maara) && maara > 0) summa += maara
  }

  return summa
}

/*
 * Selittämätön ylitys. Tämä on se luku jonka kuuluu olla nolla ja jonka
 * nollasta poikkeaminen tarkoittaa tuntematonta kirjoittajaa.
 *
 * Negatiivista ei palauteta: nollarivien määrä voi myös laskea, jos
 * tapahtumia siivotaan, eikä se ole hälytys.
 */
export function selittamattomatNollarivit(
  nollarivitYhteensa: number,
  odotetut: number
): number {
  return Math.max(0, nollarivitYhteensa - odotetut)
}
