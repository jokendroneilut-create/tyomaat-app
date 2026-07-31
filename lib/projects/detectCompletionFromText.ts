/*
 * Tunnistaa lehdistötiedotteen otsikosta että hanke on jo VALMIS.
 *
 * Tausta: yritysten tiedotteista merkittävä osa kertoo valmistumisesta
 * ("FINNOONNIITYN LINJA-AUTOVARIKKO VALMIS", "... luovutettu tilaajalle").
 * Tuontipolku osaa jo merkitä osuneen hankkeen valmistuneeksi, mutta vain
 * jos lähde asettaa completed-lipun - eikä yksikään yritysfetcher aseta sitä.
 * Tekstipohjainen päättely katsoi aiemmin vain päivämääriä
 * (inferCompletionDateFromText), joten sanamuoto jäi huomaamatta.
 *
 * Sanat poistetaan myös otsikosta ennen täsmäytystä: juuri se sana joka
 * tekee uutisesta arvokkaan ("VALMIS") rikkoi otsikko-osuman ja esti
 * hankkeen tunnistamisen. Mitattu tapaus: identtinen otsikko antoi 55
 * pistettä, sama otsikko sanalla VALMIS ei osunut lainkaan.
 */

/*
 * Vain yksiselitteisiä valmistumisilmauksia. Esimerkiksi "valmistuu" tai
 * "valmistumassa" EI ole listalla, koska ne kertovat tulevasta - samoin
 * "valmisteleva" (kuten "rakentamista valmisteleva puiden kaato"), joka
 * osuisi pelkkään alkuosaan.
 */
const COMPLETION_PATTERNS: RegExp[] = [
  /\bvalmis\b/i,
  /\bvalmistui\b/i,
  /\bvalmistuivat\b/i,
  /\bvalmistunut\b/i,
  /\bluovutettu\b/i,
  /\bluovutettiin\b/i,
  /\bharjannostajaisia\b/i,
  /\botettiin käyttöön\b/i,
  /\botettu käyttöön\b/i,
  /\bvihittiin käyttöön\b/i,
]

/*
 * Sanat jotka poistetaan otsikosta täsmäytystä varten. Sisältää myös
 * tavalliset liitteet ("on valmis", "- valmis") ja välimerkit joita jää
 * jäljelle poiston jälkeen.
 */
const TITLE_NOISE =
  /\s*[-–—,:]?\s*\b(on\s+)?(nyt\s+)?(valmis|valmistui|valmistuivat|valmistunut|luovutettu|luovutettiin)\b\s*(tilaajalle|asiakkaalle|käyttöön)?\s*[.!]?\s*$/i

export function textIndicatesCompletion(
  ...texts: (string | null | undefined)[]
): boolean {
  const joined = texts.filter(Boolean).join(" ")
  if (!joined.trim()) return false

  return COMPLETION_PATTERNS.some((pattern) => pattern.test(joined))
}

/*
 * Otsikko ilman valmistumissanaa. Palauttaa alkuperäisen jos poisto ei
 * osu tai jos jäljelle jäisi liian lyhyt merkkijono (jolloin otsikko oli
 * käytännössä pelkkä tilailmaus eikä hankkeen nimi).
 */
export function stripCompletionWords(title: string | null | undefined): string | null {
  if (!title) return title ?? null

  const stripped = title.replace(TITLE_NOISE, "").trim()

  if (!stripped || stripped.length < 8) return title

  return stripped
}
