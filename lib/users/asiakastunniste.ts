/*
 * ASIAKKAAN TUNNISTE SAHKOPOSTISTA (D-223).
 *
 * Hinta on yrityskohtainen, joten laskutusrivi tarvitsee avaimen joka
 * on asiakas eika tunnus. Mitattu 1.10.2026
 * (`scripts/measure-asiakasdomainit.ts`): 113 asiakastunnusta jakautuu
 * 75 asiakkaaseen, ja viidella yrityksella on useita tunnuksia. Suurin
 * on Koneunion 13 ja Sarlin 12 — per-tunnus-hinta laskisi Sarlinin
 * MRR:aan kaksitoista kertaa.
 *
 * DOMAIN KELPAA TUNNISTEEKSI, PAITSI VAPAA SAHKOPOSTI. Johannes
 * 1.10.2026: *"domainia voi kayttaa yrityksen tunnisteena mikali ei
 * joskus tule yritysta joka kayttaisi vaikka gmail osoitteita"*. Sellaisia
 * on jo: 11 asiakastunnusta 113:sta on gmailissa tai hotmailissa. Jos
 * domain olisi avain, kaksi eri yhden hengen asiakasta olisi sama
 * "gmail.com"-asiakas ja toisen hinta katoaisi toisen alle.
 *
 * Siksi vapaan sahkopostin kayttaja tunnistetaan koko osoitteella.
 */

/*
 * Vapaat sahkopostipalvelut. Lista on tahallaan lyhyt ja suomalainen:
 * tuntematon domain tulkitaan yritykseksi, mika on oikea suunta —
 * vaara yritystulkinta nakyy sivulla ja on korjattavissa, vaara
 * yhdistaminen sulauttaisi kaksi asiakasta hiljaa yhdeksi.
 */
export const VAPAAT_SAHKOPOSTIDOMAINIT = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.fi",
  "outlook.com",
  "outlook.fi",
  "live.fi",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.fi",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "suomi24.fi",
  "luukku.com",
  "elisanet.fi",
  "kolumbus.fi",
  "saunalahti.fi",
  "pp.inet.fi",
  "dnainternet.net",
])

export function sahkopostinDomain(email: string | null | undefined): string {
  const puhdas = String(email ?? "").trim().toLowerCase()
  const kohta = puhdas.lastIndexOf("@")
  if (kohta < 0) return ""
  return puhdas.slice(kohta + 1)
}

export function onVapaaSahkoposti(email: string | null | undefined): boolean {
  return VAPAAT_SAHKOPOSTIDOMAINIT.has(sahkopostinDomain(email))
}

/*
 * Palauttaa laskutusrivin avaimen: yritysdomain tai koko osoite.
 * Tyhja merkkijono tarkoittaa ettei tunnistetta voi muodostaa.
 */
export function asiakkaanTunniste(email: string | null | undefined): string {
  const puhdas = String(email ?? "").trim().toLowerCase()
  const domain = sahkopostinDomain(puhdas)
  if (!domain) return ""
  return VAPAAT_SAHKOPOSTIDOMAINIT.has(domain) ? puhdas : domain
}
