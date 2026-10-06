/*
 * NIMIEHDOTUS VANHASTA KENTASTA (D-238).
 *
 * `profiles.full_name` on taytetty kaikille, mutta jokainen arvo on
 * JOHDETTU SAHKOPOSTIOSOITTEESTA — ei kayttajan antama. Mitattu
 * 6.10.2026: 112 tunnuksesta 76:lla siita tuli "Etunimi Sukunimi", koska
 * osoite on muotoa etunimi.sukunimi@; lopuilla 36:lla tuloksena on
 * "sladidasdriftteam", "Jjuliahanninen" tai "testi".
 *
 * Siksi arvoa EI kayteta tervehdyksessa. Sita kaytetaan vain lomakkeen
 * esitaytteena, ja silloinkin vain jos se nayttaa nimelta: kayttaja
 * vahvistaa tai korjaa sen, eika kone paata puolesta.
 */

/* Kaksi (tai useampi) isolla alkavaa sanaa, ei numeroita. */
const NIMELTA_NAYTTAVA = /^[A-ZÅÄÖ][a-zåäö'’-]+(?: [A-ZÅÄÖ][a-zåäö'’-]+)+$/

export type Nimiehdotus = { etunimi: string; sukunimi: string }

export function nimiehdotus(fullName: string | null | undefined): Nimiehdotus {
  const puhdas = String(fullName ?? "").replace(/\s+/g, " ").trim()
  if (!puhdas || !NIMELTA_NAYTTAVA.test(puhdas)) return { etunimi: "", sukunimi: "" }

  const osat = puhdas.split(" ")
  return { etunimi: osat[0], sukunimi: osat.slice(1).join(" ") }
}
