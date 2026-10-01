/*
 * ASIAKKAAN TUNNISTE SAHKOPOSTISTA (D-223).
 *
 * Hinta on yrityskohtainen, joten laskutusrivi tarvitsee avaimen joka
 * on asiakas eika tunnus. Mitattu 1.10.2026
 * (`scripts/measure-asiakasdomainit.ts`): 113 asiakastunnusta jakautuu
 * 84 asiakkaaseen (73 yritysta + 11 vapaan sahkopostin kayttajaa), ja
 * viidella yrityksella on useita tunnuksia. Suurimmat ovat Koneunion 13
 * ja Sarlin 12 — per-tunnus-hinta laskisi Sarlinin MRR:aan kaksitoista
 * kertaa.
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
 * VALITTU YRITYS VOITTAA PAATTELYN (D-224).
 *
 * Paattely sahkopostista toimii 102 tunnuksella 113:sta, mutta 11 jaa
 * yksin omaksi "asiakkaakseen" vain siksi etta heilla on gmail. Jos
 * kaksi heista on saman yrityksen vakea, sita ei voi paatella mistaan —
 * se on kerrottava. Siksi tunnukselle voi valita yrityksen, ja valinta
 * ohittaa paattelyn aina.
 *
 * Nimi normalisoidaan avaimeksi, jotta "Koneunion Oy", "koneunion oy" ja
 * " Koneunion  Oy " ovat sama asiakas. Nakyva nimi sailyy
 * `user_company.yritys`issa sellaisena kuin se kirjoitettiin.
 */
export function normalisoiYritys(yritys: string | null | undefined): string {
  return String(yritys ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/*
 * Palauttaa laskutusrivin avaimen: valittu yritys, yritysdomain tai
 * koko osoite. Tyhja merkkijono tarkoittaa ettei tunnistetta voi
 * muodostaa.
 */
export function asiakkaanTunniste(
  email: string | null | undefined,
  yritys?: string | null
): string {
  const valittu = normalisoiYritys(yritys)
  if (valittu) return valittu

  const puhdas = String(email ?? "").trim().toLowerCase()
  const domain = sahkopostinDomain(puhdas)
  if (!domain) return ""
  return VAPAAT_SAHKOPOSTIDOMAINIT.has(domain) ? puhdas : domain
}
