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
