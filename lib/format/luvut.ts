/*
 * NUMEROARVON MUOTOILU KATSELMOINTINÄKYMÄÄN.
 *
 * MIKSI. Johannes 15.10.2026: kustannusarvio näytti puuttuvan Topinojan
 * lajitteluaseman hankkeesta. Se oli poimittu oikein — ilmoituksessa
 * lukee *"Hankkeen kustannusarvio on n. 20 M€"* ja kannassa on
 * 20000000 — mutta TIC-sivu tulosti sen raakana:
 *
 *     💶 Arvioitu kustannus: 20000000
 *
 * Kahdeksan numeroa ilman välejä on luettava laskemalla, ja 20000000
 * eroaa 2000000:sta yhdellä merkillä. Oikea luku voi olla lukukelvoton.
 *
 * Asiakkaan hankelista muotoilee jo oikein (`formatEUR`,
 * `Intl.NumberFormat("fi-FI")`), joten tämä noudattaa samaa konventiota
 * eikä keksi uutta.
 *
 * KYNNYS SUOJAA VUOSILUVUT. Mitattu jonosta 15.10.2026: numeroarvoisia
 * metadata-kenttiä on 10, ja niissä on kolme eri lajia:
 *
 *   estimated_cost     531 riviä   8 509 - 900 000 000   (summa)
 *   contract_value     402 riviä   0 - 646 000 000       (summa)
 *   floor_area         249 riviä   20 - 200 000          (summa)
 *   site_area_m2        96 riviä   470 - 2 493 033       (summa)
 *   design_start_year    7 riviä   2018 - 2025           (VUOSILUKU)
 *   classification_confidence 6 128 riviä  50 - 88       (ei summa)
 *
 * `design_start_year` on se ansa: tuhaterotin tekisi siitä "2 025".
 * Vuosiluku ei kuitenkaan koskaan ylitä 9 999, joten kynnys 10 000
 * suojaa sen, varmuusluvut, asuntomäärät ja laskurit ilman erillistä
 * luetteloa.
 *
 * TUNNISTE EI OLE LUKU. Nimen perusteella rajataan lisäksi pois
 * tunnisteet (`notice_id`, `procedure_id`, lupanumero): mitattuna ne
 * ovat jonossa merkkijonoja, mutta uusi lähde voi tuoda saman kentän
 * numerona, ja silloin "59 259" olisi väärin.
 */

/* Alle tämän ei ryhmitellä: vuosiluku, varmuusluku, kappalemäärä. */
export const RYHMITTELYN_KYNNYS = 10000

const TUNNISTE_NIMI =
  /(^|_)(id|ids|numero|number|tunnus|code|koodi|year|vuosi|vuonna|pykala|§)$/i

/*
 * Ryhmittely kolmen numeron ryhmiin. fi-FI käyttää ryhmäerottimena
 * sitkeää välilyöntiä, joka on tässä oikea merkki: se estää luvun
 * katkeamisen kahdelle riville.
 */
export function muotoileLuku(arvo: number): string {
  try {
    return new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 2 }).format(arvo)
  } catch {
    /* Ilman ICU:ta ryhmitellään itse, jotta tulos on silti luettava. */
    const [kokonais, desimaalit] = String(arvo).split(".")
    const merkki = kokonais.startsWith("-") ? "-" : ""
    const numerot = merkki ? kokonais.slice(1) : kokonais
    const ryhmitelty = numerot.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    return merkki + ryhmitelty + (desimaalit ? "," + desimaalit.slice(0, 2) : "")
  }
}

/*
 * Katselmointisivun kenttäarvo. Palauttaa aina merkkijonon, jotta
 * kutsupaikka voi tulostaa sen suoraan `String(arvo)`:n tilalla.
 */
export function muotoileKenttaArvo(avain: string, arvo: unknown): string {
  if (typeof arvo !== "number" || !Number.isFinite(arvo)) return String(arvo)
  if (TUNNISTE_NIMI.test(avain)) return String(arvo)
  if (Math.abs(arvo) < RYHMITTELYN_KYNNYS) return String(arvo)
  return muotoileLuku(arvo)
}
