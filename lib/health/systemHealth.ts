/*
 * JÄRJESTELMÄN ELINTOIMINTOJEN VAHTI.
 *
 * 24.8.2026 Supabase-instanssi oli alhaalla noin 15 tuntia (23.8. klo
 * 22:00 UTC -> 24.8. klo 12:50 UTC). Kukaan ei tiennyt siitä ennen kuin
 * ylläpitäjä yritti itse kirjautua. Kirjautuminen oli mahdotonta koko
 * ajan, koska /auth/v1/health vastasi 522:lla.
 *
 * KAKSI SUUNNITTELUPAKKOA seuraa suoraan siitä miten vika ilmeni:
 *
 *   1. Vahti EI SAA tallentaa tilaansa Supabaseen. Se on juuri se palvelu
 *      joka on alhaalla silloin kun vahtia tarvitaan - tila kirjoitettaisiin
 *      kantaan joka ei vastaa. Toisto estetään siksi Resendin
 *      idempotenssiavaimella, joka elää lähettäjän päässä.
 *
 *   2. Yksittäinen epäonnistuminen ei riitä hälytykseen. Supabasella on
 *      ollut avoin häiriö ajoittaisista 401-virheistä, ja hetkellinen
 *      katkos ei ole sama asia kuin kaatunut instanssi. Siksi jokainen
 *      epäonnistuminen varmistetaan uusinnalla ennen hälytystä.
 *
 * SOKEA PISTE, joka on hyvä tietää: tämä vahti ei havaitse omaa
 * kuolemaansa. Jos Vercel on alhaalla, cron ei aja eikä hälytystä tule.
 * Sen kattaa vain sovelluksen ulkopuolinen valvonta.
 */

export type CheckResult = {
  name: string
  ok: boolean
  status: number | null
  ms: number
  error?: string
}

/*
 * Hälytys toistetaan tunnin välein niin kauan kuin vika jatkuu. Tarkistus
 * itse ajetaan tiheämmin, jotta havainto on nopea, mutta 15 tunnin katko
 * viiden minuutin välein tarkoittaisi 180 viestiä. Tunnin väli antaa
 * saman tiedon 15 viestillä ja toimii samalla muistutuksena.
 */
export function alertKey(now: Date = new Date()): string {
  return `tyomaat-health-${now.toISOString().slice(0, 13)}`
}

export function allOk(results: CheckResult[]): boolean {
  return results.every((r) => r.ok)
}

function kuvaa(r: CheckResult): string {
  const tila = r.ok ? "OK" : "VIRHE"
  const koodi = r.status === null ? (r.error ?? "ei vastausta") : `HTTP ${r.status}`
  return `  ${tila.padEnd(6)} ${r.name.padEnd(22)} ${koodi}  (${r.ms} ms)`
}

export function buildAlertEmail(results: CheckResult[], now: Date = new Date()) {
  const kaatuneet = results.filter((r) => !r.ok)

  /*
   * Otsikossa kerrotaan mikä on rikki, koska se luetaan puhelimen
   * lukitusnäytöltä. "Kirjautuminen" on täsmällisempi kuin "auth" -
   * se on se mitä asiakas ei pysty tekemään.
   */
  const nimet = kaatuneet.map((r) => r.name).join(", ")
  const aika = now.toISOString().slice(11, 16)

  const subject = `Työmaat.fi: ${nimet} ei vastaa (${aika} UTC)`

  const text = [
    `Järjestelmän vahti ei saanut yhteyttä. Tarkistus uusittiin ennen`,
    `tätä viestiä, joten kyse ei ole hetkellisestä piikistä.`,
    ``,
    `Aika: ${now.toISOString()}`,
    ``,
    `Tarkistukset:`,
    ...results.map(kuvaa),
    ``,
    `Jos kyse on koko instanssista, korjaus on yleensä uudelleenkäynnistys:`,
    `  Supabase -> Project Settings -> General -> Restart project`,
    ``,
    `24.8.2026 sama vika korjautui käynnistyksellä 6 sekunnissa. Data ei`,
    `kärsinyt. Tarkista käynnistyksen jälkeen myös keräysajot.`,
    ``,
    `Hakuvahti kuroo katkon umpeen itsestään. Työtilaisuushälytys ei -`,
    `se käyttää kiinteää 30 tunnin ikkunaa.`,
  ].join("\n")

  return { subject, text }
}

export function parseAdminEmails(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
