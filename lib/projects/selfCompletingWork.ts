/*
 * Lyhyet, itsestään päättyvät työt - ja niiden ikäraja.
 *
 * MIKSI TYYPPIKOHTAINEN EIKÄ YLEINEN IKÄRAJA. Sama aikaraja ei voi koskea
 * purkua ja peruskorjausta. Finlandia-talon perusparannus kesti vuosia ja
 * oli koko ajan elossa; päiväkodin purku ei kestä kahta vuotta. Yleinen
 * "päätös yli N vuotta vanha = valmis" sulkisi eläviä suurhankkeita.
 *
 * MIKSI PÄÄTÖSPÄIVÄ RIITTÄÄ NÄILLE. Purkupäätös tehdään, työ tehdään
 * kuukausissa, eikä siitä tule uutta päätöstä. Lähde ei kerro
 * valmistumista koskaan: mitattu 12.8.2026 koko Ahjon indeksistä
 * (143 318 päätöstä) "loppuselvitys" esiintyi 8 otsikossa ja
 * "vastaanottotarkastus" 0:ssa - valmistuminen ei kulje poliittisen
 * päätöksenteon läpi. Ikä on siis ainoa käytettävissä oleva signaali.
 *
 * MIKSI EI SANAA "VALMISTUI". Se on ansa: mitattu 38 mainintaa
 * jonoriveillä, ja katsotuista esimerkeistä valtaosa oli kohteen
 * ALKUPERÄINEN rakennusvuosi - "Hietakummun ala-aste on valmistunut
 * 1959", "Rakennus on valmistunut vuonna 1976". Sääntö sen varassa
 * merkitsisi peruskorjaushankkeen valmiiksi siksi että rakennus on vanha.
 *
 * Lista on tarkoituksella lyhyt. Purku on mitattu (62 jonoriviä, 31 yli
 * kaksi vuotta vanhaa); muita tyyppejä lisätään vasta kun ne on mitattu.
 */

/*
 * Purkaminen kohteena. Kuvio vaatii rakennussanan tai purku-urakan, jotta
 * "sopimuksen purkaminen" ja "urakkasopimuksen purkaminen" eivät osu -
 * ne ovat sopimuksen purkuja, eivät rakennustyötä.
 */
const DEMOLITION = /\bpurkam|\bpurku-?urak|\bpurkut(?:yö|yo)|\bpurkulup/i

const CONTRACT_TERMINATION =
  /sopimuksen[^,;.]{0,40}purkam|purkaa\s+sopimu|sopimu\w*\s+purkam/i

export type SelfCompletingKind = "purku"

/*
 * Kahden vuoden raja on tarkoituksellisesti väljä. Purkutyö kestää
 * kuukausia, joten kaksi vuotta antaa tilaa viivästyksille, valituksille
 * ja urakan uudelleenkilpailutukselle. Mitattu jakauma: jonon vanhimmat
 * purkupäätökset ovat vuosilta 2020-2021.
 */
export const SELF_COMPLETING_YEARS = 2

export function selfCompletingKind(
  title: string | null | undefined
): SelfCompletingKind | null {
  const text = String(title ?? "")
  if (!text) return null
  if (CONTRACT_TERMINATION.test(text)) return null
  if (DEMOLITION.test(text)) return "purku"
  return null
}

/*
 * Onko lyhyt työ niin vanha että se on varmasti tehty?
 *
 * `decisionDate` on päätöspäivä ISO-muodossa. Ilman sitä ei päätellä
 * mitään: tuontipäivä kertoo vain milloin ME näimme päätöksen, joten
 * vuosia vanha päätös näyttäisi tuoreelta.
 */
export function isFinishedShortWork({
  title,
  decisionDate,
  now = new Date(),
  years = SELF_COMPLETING_YEARS,
}: {
  title: string | null | undefined
  decisionDate: string | null | undefined
  now?: Date
  years?: number
}): boolean {
  if (!selfCompletingKind(title)) return false
  if (!decisionDate) return false

  /*
   * Epäuskottava päivä ei kelpaa perusteeksi. Sama raja kuin
   * ignore-stale-completed.ts:ssä: jäsennysvirhe ei saa merkitä
   * hanketta valmiiksi.
   */
  if (!/^20[0-4]\d-\d{2}-\d{2}/.test(decisionDate)) return false

  const cutoff = new Date(now)
  cutoff.setFullYear(cutoff.getFullYear() - years)

  return decisionDate < cutoff.toISOString().slice(0, 10)
}
