/*
 * Yritysnimen poiminta vapaasta tekstistä.
 *
 * Jaettu moduuli, koska useampi lähde tarvitsee saman: STT-tiedotteesta
 * etsitään tilaaja, YVA-aineistosta hankkeesta vastaava. Kuviot eroavat
 * lähteittäin, mutta nimen muoto ja siivous ovat samat.
 */

/*
 * Nimen osa alkaa isolla kirjaimella. Ääkköset on lueteltava erikseen:
 * \w ei kata niitä, ja ilman niitä "Ympäristö Oy" katkesi väärään kohtaan.
 */
export const NAME_PART = "[A-ZÅÄÖ][A-Za-z0-9åäöÅÄÖ&.\\-]*"
export const NAME = `${NAME_PART}(?:\\s+${NAME_PART})*`

/*
 * Yhtiömuodot, myös ulkomaiset: aineistossa on mm. "Mondo Minerals B.V." ja
 * ruotsalaisia AB-yhtiöitä. Pisteelliset muodot on lueteltava ennen
 * pisteettömiä, jottei "B" osu ensin.
 */
const COMPANY_FORMS = [
  "Oyj",
  "Oy",
  "Abp",
  "Ab",
  "Ky",
  "Ltd",
  "B\\.V\\.",
  "N\\.V\\.",
  "GmbH",
  "plc",
  "SE",
  "AS",
  "Oü",
]

const COMPANY_FORM_PATTERN = COMPANY_FORMS.join("|")

/*
 * Nimen perässä oleva välimerkki ei kuulu nimeen. Piste sallitaan sanan
 * sisällä ("As. Oy"), joten se siivotaan vasta lopusta.
 */
export function cleanCompanyName(raw: string): string {
  /*
   * Nimi katkaistaan yhtiömuotoon. Ilman tätä kaappaus jatkuu seuraavaan
   * virkkeeseen, koska piste kuuluu nimimerkkeihin ("As. Oy") ja seuraava
   * sana on usein iso alkukirjain: mitattu "HMT-Areena Oy. Tilaajien".
   */
  const withForm = raw.match(new RegExp(`^(.*?\\b(?:${COMPANY_FORM_PATTERN}))(?:\\b|\\.)`))
  const name = withForm?.[1] ?? raw

  return name
    .replace(/:n$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim()
}

/*
 * Onko nimi tunnistettavasti yritys?
 *
 * Tätä käytetään portteina siellä missä kuvio on löyhä. Esimerkiksi
 * "<nimi> suunnittelee" osuu myös virkkeeseen "Yhtiö suunnittelee" tai
 * "Hanke suunnittelee", jotka eivät ole nimiä. Yhtiömuodon vaatiminen on
 * turvallinen rajaus: mitatusta 25 YVA-hankkeesta jokaisessa mainittiin
 * Oy, Oyj, Ab tai Ky.
 */
export function looksLikeCompany(name: string | null | undefined): boolean {
  if (!name) return false
  return new RegExp(`\\b(?:${COMPANY_FORM_PATTERN})\\b|\\bB\\.V\\.|\\bN\\.V\\.`).test(name)
}
