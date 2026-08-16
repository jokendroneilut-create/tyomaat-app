import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { resolveParties, extractClientFromText } from "./fetchSttHakuSource"
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
 * Suunnittelutoimiston vaihepäättely.
 *
 * ERO URAKOITSIJAAN: `CONTRACT_PATTERNS` jätetään tarkoituksella pois.
 * Suunnittelijan tiedotteessa "sopimus solmittu" tarkoittaa
 * SUUNNITTELUsopimusta, ei urakan myöntämistä — sen lukeminen urakaksi
 * siirtäisi hankkeen vuosia edelle todellisuudesta. Rakentaminen luetaan
 * vain silloin kun teksti sanoo sen suoraan.
 */
export function inferDesignerPhase(title: string, body: string | null): string {
  const head = (title ?? "").toLowerCase()
  if (COMPLETED_KEYWORDS.some((k) => head.includes(k))) return PHASE_LABELS.completed

  const text = `${title ?? ""} ${body ?? ""}`
  if (CONSTRUCTION_PATTERNS.some((re) => re.test(text))) return PHASE_LABELS.construction

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
  /^(skip to content|mene sisältöön|siirry sisältöön|hyppää sisältöön|report this content|kuuntele juttu)\s*/i

/* Tarkin valitsin ensin, koko sivun runko vasta viimeisenä varakeinona. */
const BODY_SELECTORS = [
  "article",
  "main",
  ".article",
  ".article__body",
  ".article__content",
  ".news-article",
  ".content__main",
]

/* Alle tämän jäävä teksti on navigaatiota tai tyhjä kääre, ei tiedote. */
const MIN_BODY_LENGTH = 120


export function extractReleaseBody(html: string): string | null {
  const $ = cheerio.load(html)
  /*
   * KUVATEKSTI POIS. Se ei ole hankkeen tekstiä vaan kuvaajan krediitti,
   * ja se on ingressin EDESSÄ: Rakennuslehden sähköasemajutussa teksti
   * alkoi "Kuvituskuva. Kuva: Nyab ...". Krediitin yritysnimi menisi
   * osapuolten poimintaan valokuvaajana eikä rakentajana.
   */
  $("script, style, noscript, nav, header, footer, iframe, form, figcaption").remove()

  /*
   * PISIN SIIVOTTU OSUMA, EI ENSIMMÄINEN.
   *
   * `.first()` kaatui tyhjään kääreeseen: Sitowisen tiedotesivulla on 15
   * <article>-elementtiä, joista ensimmäinen on 5 merkkiä ja toinen koko
   * 5780 merkin tiedote (mitattu 16.8.2026). Ensimmäinen jäi alle 120
   * merkin kynnyksen, joten koko sivu palautti null ja jokainen ehdokas
   * tuli ilman kuvausta — juuri se vika joka D-027:n mukaan johtaa 80-100 %
   * hylkäysasteeseen katselmoinnissa.
   *
   * Pituus mitataan SIIVOUKSEN JÄLKEEN. Raakapituudella mitattuna valinta
   * osui elementtiin, joka siivouksessa katkesi "Lue myös" -kohdasta:
   * Rakennuslehti heikkeni 905 merkistä 267:ään. Siivottu pituus on se
   * mikä lopulta jää käyttöön, joten valinta on tehtävä siitä.
   *
   * Vertailu tehdään KAIKKIEN valitsimien kesken, ei valitsin kerrallaan.
   * Vanha `.first()` valitsi unionista dokumenttijärjestyksessä ensimmäisen,
   * ei ensimmäisen valitsimen osumaa — Rakennuslehdellä voittaja oli `main`,
   * ei `article`. Valitsinkohtainen järjestys olisi siis ollut uusi sääntö,
   * ei entisen säilyttämistä, ja se pudotti Rakennuslehden 905 merkistä
   * 267:ään (mitattu 16.8.2026).
   */
  let best = ""

  $(BODY_SELECTORS.join(", ")).each((_, el) => {
    const candidate = cleanReleaseText($(el).text())
    if (candidate.length > best.length) best = candidate
  })

  if (best.length >= MIN_BODY_LENGTH) return best.slice(0, 4000)

  const fallback = cleanReleaseText($("body").text())

  return fallback.length >= MIN_BODY_LENGTH ? fallback.slice(0, 4000) : null
}

/* Murupolun, naapuriartikkelien ja sivukaluston poisto yhdestä ehdokkaasta. */
function cleanReleaseText(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim()

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
  return text
    .split(/sinua saattaisi kiinnostaa|lue myös|muita uutisia|muut tiedotteet|aiheeseen liittyvät/i)[0]
    .trim()
    .replace(LEADING_JUNK, "")
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
   *
   * "designer" on suunnittelutoimisto (Sitowise, WSP, Sweco). Se EI ole
   * kumpikaan osapuoli, joita palvelu seuraa: julkaisijaa ei siis kirjata
   * kumpaankaan kenttään lainkaan, vaan ainoastaan tekstistä löytyvä
   * tilaaja rakennuttajaksi. Ilman omaa rooliaan oletuslogiikka kirjaisi
   * Sitowisen rakennuttajaksi aina kun tilaajaa ei saada jäsennettyä.
   */
  role?: "builder" | "developer" | "designer"
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

    /*
     * SUUNNITTELIJA EI OLE OSAPUOLI. Julkaisijaa ei kirjata kumpaankaan
     * kenttään; rakennuttajaksi kelpaa vain tekstistä nimetty tilaaja.
     * `resolveParties` palauttaisi tässä julkaisijan rakennuttajaksi aina
     * kun tilaajaa ei löydy, mikä olisi juuri se väärä tieto jota ihminen
     * ei osaisi epäillä ("Sitowise rakennuttaa Vantaan ratikan").
     */
    if (role === "designer") {
      const clientFromText = extractClientFromText(candidate.name, lead)

      return {
        ...candidate,
        description: body,
        city: candidate.city ?? detectCityFromText(body),
        location: candidate.location ?? extractStreetAddress(body),
        developer:
          clientFromText && clientFromText.toLowerCase() !== publisher.toLowerCase()
            ? clientFromText
            : candidate.developer ?? null,
        builder: candidate.builder ?? null,
        /*
         * Lähteen jo toteama valmistuminen EI saa kumoutua rikastuksessa.
         * `inferDesignerPhase` tuntee vain sanat "valmistui/valmistunut",
         * joten "Kruunusillat-allianssi TOTEUTTI liikennehankkeen" olisi
         * palautunut suunnitteluvaiheeseen — valmis hanke näkyisi
         * asiakkaalle avoimena mahdollisuutena (mitattu 16.8.2026).
         */
        phase: candidate.completed
          ? candidate.phase
          : inferDesignerPhase(candidate.name, body),
        property_type:
          candidate.property_type ?? inferBuildingType(candidate.name, body),
        estimated_completion:
          candidate.estimated_completion ?? parseEstimatedCompletionDate(body),
      }
    }

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
