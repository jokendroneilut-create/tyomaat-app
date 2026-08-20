import { extractStreetAddress } from "@/lib/agent/extractStreetAddress"

/*
 * KATUAVAIN: katu + talonumero vertailukelpoisessa muodossa.
 *
 * Sama rakennus kirjoitetaan lähteissä eri tavoin:
 *
 *   "Osoite Hiihtomäentie 23, 00800 Helsinki"
 *   "Hiihtomäentie 23, Helsinki"
 *
 * Molemmista tulee avain "hiihtomäentie 23".
 *
 * TÄTÄ EI SAA KYTKEÄ AUTOMAATTISEEN YHDISTÄMISEEN. Mitattu 19.8.2026
 * (D-090): samalla kadulla ja numerolla on aidosti eri hankkeita —
 * "Maunonkatu 2, Oulu" on kaksi eri taloyhtiötä ja "Koroistentie 10"
 * kolme täysin eri hanketta. Katuavaimella yhdistäminen olisi sotkenut ne.
 *
 * Avain on siis tarkoitettu VAIN ihmiselle näytettävään ehdotuslistaan,
 * jossa väärä ehdotus maksaa yhden silmäyksen. Siksi se on myös tahallaan
 * karkea: talonumeron kirjainosa jätetään pois ("4 a" ja "4a" -> "4"),
 * koska ehdotuksissa kattavuus on tärkeämpää kuin tarkkuus.
 */

export function streetKey(address: string | null | undefined): string | null {
  if (!address) return null

  /*
   * Poiminta vaatii talonumeron, joten pelkkä kaupunki tai kaupunginosa
   * ("Helsinki", "Herttoniemi") ei tuota avainta. Se on tarkoitus: ilman
   * numeroa avain osuisi kaikkiin saman alueen hankkeisiin.
   */
  const street = extractStreetAddress(address)
  if (!street) return null

  const match = street.match(/^(.*?)\s+(\d+)/)
  if (!match) return null

  return `${match[1].toLowerCase().trim()} ${match[2]}`
}

/*
 * Sama katuosoite molemmilla. Tyhjä avain ei koskaan osu.
 */
export function haveSameStreetAddress(
  first: string | null | undefined,
  second: string | null | undefined
): boolean {
  const a = streetKey(first)
  const b = streetKey(second)
  return Boolean(a && b && a === b)
}
