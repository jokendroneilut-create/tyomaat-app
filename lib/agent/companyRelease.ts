import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { resolveParties } from "./fetchSttHakuSource"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { inferBuildingType, LEAD_LENGTH } from "./buildingType"

/*
 * Yrityksen lehdistötiedotteen lukeminen: kuvaus, vaihe, osapuolet ja
 * kohdetyyppi.
 *
 * MIKSI JAETTU. Yrityslähteitä on parikymmentä ja ne noudattavat samaa
 * kaavaa: listaussivu antaa otsikon ja osoitteen, varsinainen sisältö on
 * tiedotesivulla. Mitattu (scripts/audit-company-sources.ts): 13 lähdettä
 * tuotti ehdokkaita joilla ei ollut kuvausta lainkaan, ja niistä 80-100 %
 * hylättiin katselmoinnissa - kuvaukseton ehdokas ei ole arvioitavissa
 * (D-027). Lisäksi rakennuttaja, urakoitsija ja kohdetyyppi olivat 0 %
 * kaikilla, ja vaihe lähes aina "Suunnittelussa" vaikka urakoitsija
 * tiedottaa tyypillisesti vasta kun sopimus on tehty.
 *
 * Sama korjaus tehtiin ensin Peabille yksinään. Tämä on se toteutus
 * yleistettynä, jotta seuraavat kaksitoista lähdettä eivät vaadi kukin
 * omaansa.
 */

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "luovutettu", "otettu käyttöön"]

/*
 * Urakan myöntämisen merkit. Pelkkä "toteuttaa" ei riitä, koska se esiintyy
 * myös suunnitteluvaiheen tiedotteissa - vaaditaan rahallinen arvo,
 * sopimussana tai tilaajan maininta allatiivissa.
 */
const CONTRACT_PATTERNS = [
  /urakkasumma/i,
  /urakan\s+arvo/i,
  /sopimuksen\s+arvo/i,
  /urakkasopimu/i,
  /allekirjoitti(?:vat)?\s+(?:urakka)?sopimuksen/i,
  /solmi(?:vat)?\s+(?:urakka)?sopimuksen/i,
  /\btilaus\b/i,
  /valittiin\s+urakoitsijaksi/i,
  /(?:ovat\s+sopineet|on\s+sopinut)/i,
  /urakka\s+(?:sisältää|käsittää)/i,
  /(?:toteuttaa|rakentaa|peruskorjaa|saneeraa)\s+[A-ZÅÄÖ][\wÅÄÖåäö-]*(?:\s+[\wÅÄÖåäö-]+)?:?lle\b/,
]

const CONSTRUCTION_PATTERNS = [
  /rakennustyöt\s+(?:ovat\s+)?(?:alkaneet|käynnissä)/i,
  /rakentaminen\s+on\s+(?:alkanut|käynnissä)/i,
  /harjannostajaisia/i,
  /peruskivi/i,
]

/*
 * Omaperusteinen tuotanto: yritys on tällöin aidosti sekä rakennuttaja että
 * urakoitsija. Ilman tätä merkkiä samaa yritystä ei kirjata molempiin.
 */
const OWN_DEVELOPMENT = /omaperustei|vapaarahoittei|oma\s+tuotanto|perustajaurakoin/i

/*
 * Vaihe päätellään otsikosta JA leipätekstistä. Järjestys on
 * tarkoituksellinen: valmistuminen voittaa rakentamisen ja rakentaminen
 * voittaa sopimuksen, koska tiedote mainitsee usein aiemmat vaiheet
 * taustana ("Olemme aiemmin rakentaneet... Rakennus valmistui 2025").
 */
export function inferCompanyPhase(title: string, body: string | null): string {
  const head = (title ?? "").toLowerCase()

  /*
   * Valmistuminen luetaan VAIN otsikosta. Leipätekstin "valmistui" viittaa
   * lähes aina aiempaan kohteeseen; jos se luettaisiin, hanke merkittäisiin
   * valmistuneeksi ja katoaisi asiakasnäkymästä.
   */
  if (COMPLETED_KEYWORDS.some((k) => head.includes(k))) return PHASE_LABELS.completed

  const text = `${title ?? ""} ${body ?? ""}`
  if (CONSTRUCTION_PATTERNS.some((re) => re.test(text))) return PHASE_LABELS.construction
  if (CONTRACT_PATTERNS.some((re) => re.test(text))) return PHASE_LABELS.contract_awarded
  return PHASE_LABELS.planning
}

/*
 * Tiedotesivun leipäteksti. Sivun runko on täynnä navigaatiota, joten
 * otetaan ensin artikkelielementti ja vasta viimeisenä koko body.
 * Murupolku on luotettava katkaisukohta silloin kun artikkelielementtiä ei
 * löydy.
 */
const CRUMB_MARKERS = ["You are here:", "Olet tässä:", "Etusivu /"]

/*
 * Sivun alusta poistettava kalusto. Nämä eivät ole navigaatioelementteinä
 * vaan tekstinä, joten selektoripoisto ei niitä tavoita.
 */
const LEADING_JUNK =
  /^(skip to content|mene sisältöön|siirry sisältöön|hyppää sisältöön|report this content)\s*/i


export function extractReleaseBody(html: string): string | null {
  const $ = cheerio.load(html)
  $("script, style, noscript, nav, header, footer, iframe, form").remove()

  const article = $(
    "article, main, .article, .article__body, .article__content, .news-article, .content__main"
  )
    .first()
    .text()

  let text = (article || $("body").text()).replace(/\s+/g, " ").trim()

  for (const marker of CRUMB_MARKERS) {
    const at = text.indexOf(marker)
    if (at < 0) continue
    const after = text.slice(at).split("/").slice(3).join("/").trim()
    if (after.length > 200) {
      text = after
      break
    }
  }

  /*
   * "Sinua saattaisi kiinnostaa" -palkki listaa MUIDEN artikkeleiden
   * otsikoita - leikataan pois, jottei väärä kaupunki tai päivämäärä
   * poimiudu naapuriartikkelista.
   */
  text = text
    .split(/sinua saattaisi kiinnostaa|lue myös|muita uutisia|muut tiedotteet|aiheeseen liittyvät/i)[0]
    .trim()
    .replace(LEADING_JUNK, "")

  return text.length >= 120 ? text.slice(0, 4000) : null
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export type CompanyEnricherOptions = {
  /** Yrityksen nimi sellaisena kuin se halutaan kantaan, esim. "Varte". */
  publisher: string
  /*
   * Kumpi osapuoli julkaisija on omissa tiedotteissaan.
   *
   * Urakoitsija tiedottaa saamastaan urakasta ("rakentaa X:lle"), jolloin
   * tilaaja on rakennuttaja. Rakennuttaja taas tiedottaa omasta
   * hankkeestaan ("rakennutamme uuden kohteen"), eikä urakoitsija ole
   * välttämättä edes tiedossa.
   *
   * Oletus on urakoitsija, koska valtaosa lähteistä on rakennusliikkeitä.
   * Väärä rooli kirjoittaisi esimerkiksi Y-Säätiön urakoitsijaksi, vaikka
   * se on rakennuttaja.
   */
  role?: "builder" | "developer"
}

export { inferBuildingType, LEAD_LENGTH }

/*
 * Palauttaa enrich-koukun, jota legacyFetchCollector kutsuu VAIN vielä
 * näkemättömille ehdokkaille - eli yksi sivuhaku per uusi tiedote.
 */
export function createCompanyEnricher({
  publisher,
  role = "builder",
}: CompanyEnricherOptions) {
  return async function enrichCompanyCandidate(candidate: any): Promise<any> {
    if (!candidate?.source_url) return candidate

    const html = await fetchHtml(candidate.source_url)
    if (!html) return candidate

    const body = extractReleaseBody(html)
    if (!body) return candidate

    /*
     * Urakoitsijan tiedotteessa rakennuttaja otetaan tekstistä löytyvästä
     * tilaajasta. JOS TILAAJAA EI LÖYDY, rakennuttaja jää tyhjäksi - ei
     * julkaisijaksi. Saman yrityksen kirjaaminen molempiin väittäisi
     * hanketta omaperusteiseksi, ja se on väärä tieto silloin kun tilaaja
     * vain jäi jäsentämättä. Poikkeus on aito omaperusteinen tuotanto,
     * jonka teksti kertoo.
     */
    /*
     * Osapuolet luetaan vain ingressistä. Koko sivulta luettuna tilaajaksi
     * poimiutui naapuriartikkelin yritys - mitattu "Garmin" Skanskan
     * koulu-urakassa ja "Robonic" Hartelan hoivahankkeessa, molemmat sivun
     * lopun tiedotelistasta.
     */
    const lead = body.slice(0, LEAD_LENGTH)
    const parties = resolveParties(publisher, candidate.name, lead)
    const client = parties.builder ? parties.developer : null
    const ownDevelopment = OWN_DEVELOPMENT.test(lead)

    const developer =
      role === "developer"
        ? publisher
        : client ?? (ownDevelopment ? publisher : candidate.developer ?? null)

    /*
     * Rakennuttajan tiedotteesta urakoitsijaa ei yleensä saa luotettavasti,
     * joten kenttä jää siihen mitä lähde on jo antanut.
     */
    const builder = role === "developer" ? candidate.builder ?? null : publisher

    return {
      ...candidate,
      /*
       * Tiedotesivun teksti voittaa listauksen tiivistelmän: se on sama
       * sisältö täydellisenä. Listauksesta saatu kuvaus on tyypillisesti
       * 150-250 merkkiä, artikkeli 1000-2000.
       */
      description: body,
      city: candidate.city ?? detectCityFromText(body),
      location: candidate.location ?? extractStreetAddress(body),
      developer,
      builder,
      phase: inferCompanyPhase(candidate.name, body),
      property_type: candidate.property_type ?? inferBuildingType(candidate.name, body),
      estimated_completion:
        candidate.estimated_completion ?? parseEstimatedCompletionDate(body),
    }
  }
}
