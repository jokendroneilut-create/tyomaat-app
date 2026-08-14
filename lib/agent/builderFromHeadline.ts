import { NAME, cleanCompanyName } from "./companyName"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"

/*
 * URAKOITSIJA UUTISOTSIKOSTA.
 *
 * Yritysten omilla sivuilla urakoitsija tiedetään julkaisijasta
 * (`createCompanyEnricher`), mutta uutislähteillä - Rakennuslehti,
 * kaupunkien uutiset - julkaisija on toimitus. Silloin ainoa tieto on
 * otsikon rakenne, ja se on hyvin vakiintunut:
 *
 *   "Nyab rakentaa sähköaseman Forssaan"
 *   "Skanska rakentaa Fazerille suklaatehtaan Lahteen"
 *   "Hartela urakoi seitsemän rivitaloa Kirkkonummelle"
 *
 * TEKIJÄ ON LAUSEEN ALUSSA. Kuvio ankkuroidaan otsikon alkuun, koska
 * keskeltä poimittu nimi on lähes aina joku muu kuin tekijä: "Kaupunki
 * valitsi Lujatalon rakentamaan koulun" nimeäisi kaupungin.
 */

/*
 * VAIN URAKOINTIVERBIT. "rakennuttaa" on tarkoituksella pois: se
 * tarkoittaa teettämistä, eli tekijä on silloin rakennuttaja eikä
 * urakoitsija. Sama koskee sanoja "suunnittelee" ja "kaavoittaa".
 */
const BUILDER_VERB =
  /^(?:rakentaa|urakoi|toteuttaa|saneeraa|peruskorjaa|laajentaa|remontoi|louhii)$/i

/*
 * Yleissanat jotka alkavat isolla mutta eivät ole yrityksiä. Kunnat
 * tarkistetaan erikseen rekisteristä, joten niitä ei tarvitse listata.
 */
const NOT_A_COMPANY =
  /^(?:kaupunki|kunta|valtio|senaatti|hallitus|yhtiö|yritys|urakoitsija|rakennuttaja|tilaaja|hanke|uusi|uuden|ensimmäinen|nyt|näin|miten|kuka)$/i

const HEADLINE = new RegExp(`^(${NAME})\\s+([a-zåäö]+)`)

export function builderFromHeadline(
  title: string | null | undefined
): string | null {
  const text = String(title ?? "").trim()
  if (!text) return null

  const match = text.match(HEADLINE)
  if (!match) return null

  const [, rawName, verb] = match
  if (!BUILDER_VERB.test(verb)) return null

  const name = cleanCompanyName(rawName)
  if (!name) return null

  /*
   * Kunta ei ole urakoitsija vaikka lause olisi muodollisesti sama:
   * "Espoo rakentaa uuden koulun" kertoo tilaajasta.
   */
  if (getMunicipalityByAnyForm(name)) return null

  const first = name.split(/\s+/)[0]
  if (NOT_A_COMPANY.test(first)) return null

  /*
   * Yhden kirjaimen tai pelkän lyhenteen mittainen nimi on lähes aina
   * jäsennysvirhe, ei yritys.
   */
  if (name.length < 3) return null

  /*
   * TILAAJA ALLATIIVISSA EROTTAA URAKOITSIJAN RAKENNUTTAJASTA.
   *
   * "X rakentaa" yksin ei kerro kummasta on kyse: omaperusteisessa
   * tuotannossa tekijä rakentaa itselleen. Mitattu 14.8.2026 otsikoista
   * jotka läpäisivät kuvion ilman tätä ehtoa:
   *
   *   "Espoon Asunnot rakentaa 82 vuokra-asuntoa"   -> rakennuttaja
   *   "PeeÄssä rakentaa S-marketin Neulamäkeen"     -> rakennuttaja
   *   "Mainiokodit rakentaa asumispalveluyksikön"   -> rakennuttaja
   *
   *   "Hartela rakentaa TA:lle kerrostalon"         -> urakoitsija
   *   "Jatke rakentaa TVT Asunnoille"               -> urakoitsija
   *
   * Allatiivimuotoinen tilaaja on siis se merkki joka tekee tekijästä
   * urakoitsijan. Ilman sitä nimi jätetään poimimatta - väärä rooli on
   * pahempi kuin tyhjä kenttä, koska urakoitsijaa käytetään
   * kilpailija-analyysiin.
   */
  const rest = text.slice(match[0].length)
  if (!/[A-Za-zÅÄÖåäö]{2,}(?::)?ll[ea]\b/.test(rest)) return null

  return name
}
