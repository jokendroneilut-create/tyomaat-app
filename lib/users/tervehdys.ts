/*
 * TERVEHDYS KELLONAJAN MUKAAN (D-238).
 *
 * Johannes 6.10.2026: *"Korvataan lihavoitu Tänään sana tuolla
 * tervehdyksellä. Kellonaikojen pitää olla siten että aina on joku noista
 * kolmesta. Aseta kello noudattamaan Helsingin aikaa."*
 *
 * HELSINGIN AIKA, EI PALVELIMEN. Vercel ajaa UTC:ssä, joten palvelimella
 * laskettu tervehdys olisi kesäaikaan kolme tuntia väärässä — aamuseitsemältä
 * lukisi "Iltaa". Tunti luetaan siksi aina `Europe/Helsinki`-vyöhykkeeltä,
 * eikä selaimen omasta kellosta: asiakas voi olla matkoilla, mutta palvelu
 * on suomalainen ja työmaat ovat Suomessa.
 *
 * KOLME VAIHTOEHTOA KATTAVAT VUOROKAUDEN. Rajat on valittu niin ettei
 * yhtään tuntia jää ilman tervehdystä:
 *
 *   05-09  Huomenta
 *   10-16  Päivää
 *   17-04  Iltaa
 *
 * Yöllä kello kolmelta lukee "Iltaa". Se on tahallista: "Yötä" ei ole
 * tervehdys vaan hyvästely, ja kolmelta kirjautuva on yleensä vielä
 * illassaan.
 */

export type Vuorokaudenaika = "Huomenta" | "Päivää" | "Iltaa"

export function tervehdysTunnista(tunti: number): Vuorokaudenaika {
  if (tunti >= 5 && tunti <= 9) return "Huomenta"
  if (tunti >= 10 && tunti <= 16) return "Päivää"
  return "Iltaa"
}

/* Tunti Helsingin aikaa annetusta hetkestä. */
export function helsinginTunti(hetki: Date = new Date()): number {
  const muotoiltu = new Intl.DateTimeFormat("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "numeric",
    hour12: false,
  }).format(hetki)

  /*
   * Muotoilija palauttaa "07" tai "7" ympäristöstä riippuen, ja
   * keskiyöllä joissain ympäristöissä "24". Molemmat normalisoidaan.
   */
  const tunti = Number(muotoiltu.replace(/[^0-9]/g, ""))
  return Number.isFinite(tunti) ? tunti % 24 : new Date().getHours()
}

/*
 * Koko tervehdys. Nimetön tapaus on tahallaan tuettu: pakotettu lomake
 * estää sen käytännössä, mutta tervehdys ei saa rikkoutua siihen että
 * nimi puuttuu — tyhjä on parempi kuin "Huomenta, undefined".
 */
export function tervehdi(etunimi: string | null | undefined, hetki: Date = new Date()): string {
  const aika = tervehdysTunnista(helsinginTunti(hetki))
  const nimi = String(etunimi ?? "").trim()
  return nimi ? `${aika}, ${nimi}` : aika
}
