/*
 * Katuosoite vapaasta tekstistä.
 *
 * Talonumero vaaditaan: pelkkä paikannimi ei kelpaa osoitteeksi, koska
 * kaupunkitason sijainti ei ole täsmäytyksen todiste (ks. isSpecificLocation
 * lib/agent/projectMatcher.ts). "Siilinjärven Jokisuuntiellä" jää siis
 * poimimatta, "Jokisuuntie 12" poimitaan.
 *
 * Jaettu moduuli, koska useampi lähde tarjoaa osoitteen leipätekstissä.
 */
const STREET_SUFFIXES = [
  "katu",
  "tie",
  "kuja",
  "polku",
  "väylä",
  "kaari",
  "raitti",
  "rinne",
  "aukio",
  "puisto",
  "ranta",
  "kenttä",
  "silta",
]

const ADDRESS_PATTERN = new RegExp(
  `\\b([A-ZÅÄÖ][a-zåäö]+(?:${STREET_SUFFIXES.join("|")})\\s+\\d+[a-zA-Z]?)\\b`
)

export function extractStreetAddress(text: string | null | undefined): string | null {
  if (!text) return null
  return text.match(ADDRESS_PATTERN)?.[1] ?? null
}

/*
 * Kadunnimi ILMAN talonumeroa, taivutusmuodoista perusmuotoon.
 *
 * MIKSI ERIKSEEN. Talonumeron vaatimus yllä on tarkoituksellinen eikä sitä
 * saa löysätä: numeroton osoite ei ole täsmäytyksen todiste. Kadunnimi on
 * silti ihmiselle arvokas — se on tarkempi kuin kaupunki. Mitattu tapaus
 * 18.8.2026: Varten hoivakodin teksti sanoo "Nokian Pinsiöntielle", joten
 * katu oli tiedossa mutta esikatselussa luki "Sijainti / osoite: -".
 *
 * Tulos EI mene `location`-kenttään vaan omaan vihjekenttäänsä, jottei se
 * vaikuta duplikaattitäsmäytykseen. Se on tieto katsojalle, ei avain.
 */
const STREET_NAME_PATTERN = new RegExp(
  `\\b([A-ZÅÄÖ][a-zåäö]+(?:${STREET_SUFFIXES.join("|")}))(?:lle|llä|lla|ltä|lta|n|ä|a|en|een)?\\b`
)

export function extractStreetName(text: string | null | undefined): string | null {
  if (!text) return null

  /* Täysi osoite talonumeroineen on aina parempi — se kuuluu locationiin. */
  if (ADDRESS_PATTERN.test(text)) return null

  return text.match(STREET_NAME_PATTERN)?.[1] ?? null
}
