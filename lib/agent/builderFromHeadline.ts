import { NAME, cleanCompanyName, allativeToNominative } from "./companyName"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"
import { LEAD_LENGTH } from "./buildingType"

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

/*
 * TILAAJA ALLATIIVISSA - VAIN OTSIKOSTA.
 *
 * Allatiivi ei ole yksiselitteinen tilaajan merkki: se on suomessa myös
 * MÄÄRÄNPÄÄ. "Fira rakentaa pysäköintitalon Hyvinkäälle" ei nimeä
 * tilaajaa lainkaan. Mitattu 14.8.2026: 57 osumasta yksi nojasi
 * paikannimeen, joten paikannimi suljetaan pois.
 *
 * Kuvio pidetään otsikossa. Leipätekstissä `-lle` osuu jatkuvasti
 * yleissanoihin ("tontille", "alueelle", "katolle"), joten siellä
 * vaaditaan täsmällisempi todiste - ks. leadNamesClient.
 */
const ALLATIVE = /([A-Za-zÅÄÖåäö]{2,})(?::)?ll[ea]\b/g

function headlineNamesClient(rest: string): boolean {
  for (const match of rest.matchAll(ALLATIVE)) {
    if (getMunicipalityByAnyForm(match[1])) continue
    return true
  }
  return false
}

/*
 * TILAAJA LEIPÄTEKSTISTÄ.
 *
 * Osa otsikoista ei nimeä tilaajaa vaikka juttu on urakkauutinen:
 * "Nyab rakentaa sähköaseman Forssaan". Tilaaja on silloin ingressissä:
 * "Infrarakentaja Nyab on sopinut kantaverkkoyhtiö Fingridin kanssa
 * ... sähköaseman rakentamisesta."
 *
 * Sopimuskumppanin NIMEÄ ei yritetä poimia: genetiivin perusmuotoa ei
 * voi päätellä yksikäsitteisesti ("Fingridin" -> Fingrid, mutta
 * "Skanskan" -> Skanska). Tässä riittää TODISTE erillisestä
 * tilaajasta - nimi on rakennuttaja-kentän asia, ei tämän.
 *
 * Vain ingressi luetaan (LEAD_LENGTH), samasta syystä kuin
 * companyRelease: koko sivulta luettuna osapuoleksi poimiutui
 * naapuriartikkelin yritys.
 */
const CONTRACT_WITH = /\bsopi(?:nut|neet|vat)?\b[^.]{0,120}\bkanssa\b/i
const ROLE_NAMED = /\b(?:tilaajana|rakennuttajana)\b|:n\s+toimeksiannosta\b/i
const CONSTRUCTION = /rakenta|rakennut|urak|toteutu|saneera|peruskorja/i

/*
 * "Yhteistyössä X:n kanssa" on kumppanuus, ei tilaus - siitä ei voi
 * päätellä kumpi osapuoli on urakoitsija.
 */
const PARTNERSHIP = /yhteisty/i

function leadNamesClient(description: string): boolean {
  const lead = description.slice(0, LEAD_LENGTH)
  if (ROLE_NAMED.test(lead)) return true

  for (const sentence of lead.split(/(?<=[.!?])\s+/)) {
    if (!CONTRACT_WITH.test(sentence)) continue
    if (PARTNERSHIP.test(sentence)) continue
    if (!CONSTRUCTION.test(sentence)) continue
    return true
  }
  return false
}

/*
 * URAKAN VASTAANOTTAMINEN KERTOO ROOLIN ITSESSÄÄN (D-214).
 *
 * "X rakentaa" ei kerro kummasta roolista on kyse, ja siksi alla vaaditaan
 * erikseen nimetty tilaaja. Kaksi otsikkomuotoa ei tarvitse sitä todistetta
 * lainkaan, koska urakan voi VASTAANOTTAA vain urakoitsijana:
 *
 *   "Are sai viiden miljoonan talotekniikkaurakan kouluhankkeesta"
 *   "Kreate sai tasoristeysten poistourakan Lapista"
 *   "Lujatalolle muutosurakka Helsingin Herttoniemestä"
 *   "Jatkeelle toimitilaurakka Helsingin keskustasta"
 *
 * Kohde on rajattu urakkaan ja projektiin tarkoituksella. "X:lle uusi
 * sairaala" on sama muoto mutta päinvastainen rooli - siinä X saa
 * rakennuksen, ei urakkaa.
 *
 * Mitattu 25.9.2026 Rakennuslehden 81 otsikolla: nykyinen sääntö poimi
 * viisi, "sai/voitti" tuo kolme ja allatiivi seitsemän lisää - eli
 * 5 -> 15 (19 %). Luin kaikki kymmenen läpi, yksikään ei ollut väärä.
 */
const AWARD_VERB = /^(?:sai|saa|voitti)$/i

/*
 * Urakka tai projekti, ei mikä tahansa hanke tai kohde.
 *
 * ILMAN SANANRAJAA. Urakkalaji on suomessa yhdyssanan loppuosa -
 * "talotekniikkaurakan", "poistourakan", "siltaurakka",
 * "miljoonaurakat" - joten `\burak` osui vain kahteen otsikkoon
 * kymmenestä (mitattu 25.9.2026).
 */
const AWARD_OBJECT = /urak|projekti/i

/*
 * Allatiivimuotoinen nimi otsikon alussa. Nimi voi olla monisanainen
 * ("Pohjola Rakennukselle"), joten edeltävät isolla alkavat sanat
 * otetaan mukaan.
 */
const AWARDED_TO = new RegExp(
  `^((?:[A-ZÅÄÖ][\\wåäöÅÄÖ&.\\-]*\\s+)*[A-ZÅÄÖ][\\wåäöÅÄÖ&.\\-]*lle)\\b`
)

function builderFromAward(
  text: string,
  description?: string | null
): string | null {
  const kelpaa = (nimi: string | null): string | null => {
    if (!nimi || nimi.length < 3) return null
    if (getMunicipalityByAnyForm(nimi)) return null
    if (NOT_A_COMPANY.test(nimi.split(/\s+/)[0])) return null
    return nimi
  }

  /* "X sai/voitti ... urakan" */
  const verbi = text.match(HEADLINE)
  if (verbi && AWARD_VERB.test(verbi[2])) {
    const rest = text.slice(verbi[0].length)
    if (AWARD_OBJECT.test(rest)) return kelpaa(cleanCompanyName(verbi[1]))
  }

  /*
   * "X:lle ... urakka"
   *
   * PERUSMUOTO ON VAHVISTETTAVA TEKSTISTÄ. Allatiivin purku on arvaus
   * silloin kun vartalo muuttuu: "Jatkeelle" -> sääntö antaa "Jatkee",
   * oikea nimi on "Jatke". Väärä yritysnimi näkyy asiakkaalle
   * urakoitsijana, joten arvaus ei kelpaa - nimen on esiinnyttävä
   * omana sanana otsikossa tai leipätekstissä.
   *
   * Käytännössä tämä siirtää poiminnan rikastuksen jälkeen: RSS antaa
   * vain otsikon, artikkelin teksti nimeää yrityksen perusmuodossa.
   */
  const allatiivi = text.match(AWARDED_TO)
  if (allatiivi && AWARD_OBJECT.test(text.slice(allatiivi[0].length))) {
    const konteksti = `${text} ${description ?? ""}`
    const osat = allatiivi[1].split(/\s+/)
    const viimeinen = allativeToNominative(osat[osat.length - 1], konteksti)

    if (viimeinen) {
      const nimi = kelpaa(cleanCompanyName([...osat.slice(0, -1), viimeinen].join(" ")))
      if (nimi && new RegExp(`(^|\\W)${nimi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(konteksti)) {
        return nimi
      }
    }
  }

  return null
}

export function builderFromHeadline(
  title: string | null | undefined,
  description?: string | null
): string | null {
  const text = String(title ?? "").trim()
  if (!text) return null

  const palkinto = builderFromAward(text, description)
  if (palkinto) return palkinto

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
   * Erikseen mainittu tilaaja on siis se merkki joka tekee tekijästä
   * urakoitsijan. Ilman sitä nimi jätetään poimimatta - väärä rooli on
   * pahempi kuin tyhjä kenttä, koska urakoitsijaa käytetään
   * kilpailija-analyysiin.
   *
   * Todiste kelpaa otsikosta TAI ingressistä. Pelkkä otsikko jätti
   * poimimatta juuri sen rivin josta koko sääntö sai alkunsa.
   */
  const rest = text.slice(match[0].length)
  if (headlineNamesClient(rest)) return name
  if (description && leadNamesClient(description)) return name

  return null
}
