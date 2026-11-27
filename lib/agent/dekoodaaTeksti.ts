/*
 * TAVUT TEKSTIKSI ILMAN OLETUSMERKISTÖÄ (27.11.2026, D-458).
 *
 * Sodankylän kaavalista dekoodattiin aina ISO-8859-1:nä. Kun palvelu siirtyi
 * UTF-8:aan, "Kirkonkylän" muuttui muotoon "KirkonkylÃ¤n" (näytti
 * Johanneksesta kyrilliseltä). UTF-8 kokeillaan ensin tiukkana: jos tavut
 * eivät ole kelvollista UTF-8:aa, teksti on yksitavuista ja luetaan
 * Windows-1252/ISO-8859-1:nä. Kelvollinen UTF-8 on käytännössä aina
 * tarkoitettu UTF-8:ksi, joten järjestys on turvallinen.
 */
export function dekoodaaTeksti(tavut: ArrayBuffer | Uint8Array): string {
  const data = tavut instanceof Uint8Array ? tavut : new Uint8Array(tavut)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data)
  } catch {
    return new TextDecoder("windows-1252").decode(data)
  }
}
