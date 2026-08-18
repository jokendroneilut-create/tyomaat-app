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
 * Allatiivi takaisin perusmuotoon: "Senaatti-kiinteistöille" -> "Senaatti-
 * kiinteistöt".
 *
 * Tilaaja mainitaan urakoitsijan tiedotteessa lähes aina allatiivissa
 * ("Peab toteuttaa Senaatti-kiinteistöille..."), mutta kantaan halutaan
 * perusmuoto. Suomen taivutus ei ole mekaanista, joten tässä käsitellään
 * vain ne päätteet joista muoto on yksikäsitteinen — kaikessa muussa
 * palautetaan null.
 *
 * Null on tarkoituksellinen lopputulos eikä puute: tyhjä rakennuttaja on
 * parempi kuin väärä, jonka ihminen joutuu huomaamaan ja korjaamaan. Sama
 * periaate kuin viranomaisjulkaisijan hylkäämisessä (fetchSttHakuSource).
 */
const ALLATIVE_ENDINGS: [RegExp, string][] = [
  [/öille$/, "öt"],   // kiinteistöille -> kiinteistöt
  [/oille$/, "ot"],   // taloille -> talot
  [/uille$/, "ut"],   // palveluille -> palvelut
  [/yille$/, "yt"],
  [/eille$/, "et"],   // liikkeille -> liikkeet
  [/aille$/, "at"],
  [/äille$/, "ät"],
  [/iille$/, "it"],
]

/*
 * Yleissanat jotka eivät ole yrityksen nimiä vaikka osuisivat kuvioon.
 * Isolla kirjaimella ne esiintyvät virkkeen alussa.
 *
 * Mukana ovat myös ne joiden perusmuotoa EI voi päätellä päätteestä
 * astevaihtelun takia ("kaupungille" -> kaupunki, ei "kaupungi"). Kuvio on
 * ankkuroitu alkuun, joten yhdyssanaiset oikeat nimet säilyvät:
 * "Asuntosäätiölle" ei osu sääntöön "^säätiöl".
 */
const NOT_A_CLIENT =
  /^(asiakkaa|tilaaja|käyttäji|asukkai|osakkai|kaikil|muil|niil|kaupungi|kunnal|valtiol|yhtiöl|säätiöl|seurakunnal|yhdistyksel|hankkeel|urakoitsijal)/i

export function allativeToNominative(raw: string): string | null {
  const word = raw.trim()
  if (!word.endsWith("lle") || NOT_A_CLIENT.test(word)) return null

  for (const [ending, replacement] of ALLATIVE_ENDINGS) {
    if (ending.test(word)) return word.replace(ending, replacement)
  }

  /*
   * Konsonanttiin päättyvä nimi saa sidevokaalin: "Peabille" -> "Peab".
   * Tämä on tarkistettava ENNEN vokaalisääntöä, muuten "Peabille" osuu
   * siihen ja jättää sidevokaalin nimeen ("Peabi").
   */
  const consonantStem = word.match(/^(.*[bcdfghjklmnpqrstvwxz])ille$/i)
  if (consonantStem) return consonantStem[1]

  /*
   * Vokaaliin päättyvä nimi ottaa päätteen sellaisenaan: "Kojamolle" ->
   * "Kojamo". Vokaali vaaditaan, jotta astevaihtelulliset ("kaupungille"
   * -> kaupunki) eivät osu - niiden perusmuotoa ei voi päätellä.
   */
  const vowelStem = word.match(/^(.*[aeiouyåäö])lle$/i)
  if (vowelStem) {
    /*
     * ASTEVAIHTELU JÄÄ TÄHÄN, EI ARVAUKSEEN.
     *
     * Vokaalisäännön piti sulkea astevaihtelu pois, mutta se katsoo vain
     * viimeistä kirjainta — ja vaihtelu tapahtuu sitä EDELTÄVÄSSÄ
     * konsonantissa. "HOK-Elannolle" päättyy vokaaliin, joten sääntö osui
     * ja tuotti "HOK-Elanno", vaikka perusmuoto on "HOK-Elanto" (nt -> nn).
     * Mitattu 18.8.2026: virheellinen nimi oli kannassa asiakkaalle
     * näkyvänä rakennuttajana.
     *
     * Heikon asteen kaksoiskonsonantista ei voi päätellä kumpi vahva aste
     * oli: "Elanno-" voi tulla sanasta Elanto, mutta "Auroranlinna" on jo
     * perusmuoto. Kumpikin on mahdollinen, joten kenttä jätetään tyhjäksi
     * — sama ratkaisu kuin "kaupungille" kohdalla.
     */
    if (/(nn|mm|ll|rr)[aeiouyåäö]$/i.test(vowelStem[1])) return null

    return vowelStem[1]
  }

  return null
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
