import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { resolveParties } from "./fetchSttHakuSource"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * Peabin tiedotteet. Listaussivulta saadaan vain otsikko ja osoite, joten
 * varsinainen sisältö haetaan tiedotesivulta enrich()-koukussa - samoin kuin
 * STT:llä ja Lujatalolla.
 *
 * MIKSI TÄMÄ KORJATTIIN. Ehdokas "Vanhan Vaasan sairaalan F- ja T-rakennukset"
 * syntyi tyhjänä: kuvaus null, rakennuttaja null, urakoitsija null, vaihe
 * "Suunnittelussa". Tiedotteessa oli kaikki: Peab toteuttaa Senaatti-
 * kiinteistöille suojeltujen rakennusten peruskorjauksen, urakkasumma
 * 14,5 M€. Vaihe oli väärin nimenomaan siksi ettei tekstiä luettu - urakka
 * on jo myönnetty, ei suunnitteilla.
 *
 * Sama tyhjän ehdokkaan vika korjattiin aiemmin neljälle yrityslähteelle
 * (ks. fetchLujataloSource: 72 ehdokasta tyhjänä, 93 % hylättiin). Peab jäi
 * silloin väliin.
 */

const BASE = "https://www.peab.fi"

const PROJECT_KEYWORDS = [
  "rakentaa", "rakentaminen", "rakentuu", "toteuttaa", "peruskorjaus",
  "peruskorjauksen", "peruskorjaa", "hanke", "kohde", "asunto", "asuntoa",
  "asunnot", "kodit", "kortteli", "toimitila", "toimitilat", "koulu",
  "päiväkoti", "sairaala", "datakeskus", "teollisuus", "liikuntahalli",
  "kehitysvaihe", "uudis", "korjausrakennushanke", "urakka", "urakan",
]

const EXCLUDE_KEYWORDS = [
  "nimity", "osavuosikatsaus", "tilinpäätös", "markkina", "tulos",
  "työturvallisuuskilpailu", "sertifikaatin", "leed",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "luovutettu", "otettu käyttöön"]

/*
 * Urakan myöntämisen merkit. Urakoitsija tiedottaa tyypillisesti vasta kun
 * sopimus on tehty, joten oletusvaihe "Suunnittelu" on useimmiten väärä -
 * mitattu tapaus oli Vanhan Vaasan sairaala, jossa tiedotteessa luki
 * urakkasumma mutta kantaan meni "Suunnittelussa".
 *
 * Pelkkä "toteuttaa" ei riitä merkiksi, koska se esiintyy myös
 * suunnitteluvaiheen tiedotteissa ("kehitysvaihe käynnistyy"). Vaaditaan
 * joko rahallinen arvo, sopimussana tai tilaajan maininta allatiivissa.
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
  /(?:toteuttaa|rakentaa|peruskorjaa|saneeraa)\s+[A-ZÅÄÖ][\wÅÄÖåäö-]*(?:\s+[\wÅÄÖåäö-]+)?:?lle\b/,
  /*
   * Mitattu Evijärven tiedotteesta: "Peab ja Evijärven kunta ovat sopineet
   * uuden koulu- ja kirjastorakennuksen rakentamisesta". Sopimus on tehty,
   * mutta yksikään ylläolevista ei tunnistanut sitä - vaiheeksi jäi
   * "Suunnittelu".
   */
  /(?:ovat\s+sopineet|on\s+sopinut)/i,
  /urakka\s+(?:sisältää|käsittää)/i,
]

/*
 * Omaperusteinen tuotanto: Peab on tällöin aidosti sekä rakennuttaja että
 * urakoitsija. Ilman tätä merkkiä samaa yritystä ei kirjata molempiin.
 */
const OWN_DEVELOPMENT = /omaperustei|vapaarahoittei|oma\s+tuotanto|Peab\s+Kodit/i

const CONSTRUCTION_PATTERNS = [
  /rakennustyöt\s+(?:ovat\s+)?(?:alkaneet|käynnissä)/i,
  /rakentaminen\s+on\s+(?:alkanut|käynnissä)/i,
  /harjannostajaisia/i,
  /peruskivi/i,
]

/*
 * Vaihe päätellään otsikosta JA leipätekstistä. Järjestys on tarkoituksellinen:
 * valmistuminen voittaa rakentamisen ja rakentaminen voittaa sopimuksen,
 * koska tiedote mainitsee usein aiemmat vaiheet taustana ("Peab on aiemmin
 * rakentanut ... Rakennus valmistui marraskuussa 2025").
 */
export function inferPeabPhase(title: string, body: string | null): string {
  const head = (title ?? "").toLowerCase()

  // Valmistuminen luetaan vain otsikosta: leipätekstin "valmistui" viittaa
  // tyypillisesti AIEMPAAN kohteeseen, ei tiedotteen omaan hankkeeseen.
  if (COMPLETED_KEYWORDS.some((k) => head.includes(k))) return PHASE_LABELS.completed

  const text = `${title ?? ""} ${body ?? ""}`
  if (CONSTRUCTION_PATTERNS.some((re) => re.test(text))) return PHASE_LABELS.construction
  if (CONTRACT_PATTERNS.some((re) => re.test(text))) return PHASE_LABELS.contract_awarded
  return PHASE_LABELS.planning
}

/*
 * Tiedotesivun leipäteksti. Sivun runko on täynnä navigaatiota (mitattu:
 * ensimmäiset 1200 merkkiä olivat pelkkää valikkoa), joten otetaan ensin
 * artikkelielementti ja vasta viimeisenä koko body. Murupolku "You are here:"
 * on luotettava katkaisukohta silloin kun artikkelielementtiä ei löydy.
 */
export function extractPeabBody(html: string): string | null {
  const $ = cheerio.load(html)
  $("script, style, noscript, nav, header, footer, iframe, form").remove()

  const article = $("article, main, .article, .article__body, .news-article")
    .first()
    .text()

  let text = (article || $("body").text()).replace(/\s+/g, " ").trim()

  const crumb = text.indexOf("You are here:")
  if (crumb >= 0) {
    const after = text.slice(crumb).split("/").slice(3).join("/").trim()
    if (after.length > 200) text = after
  }

  return text.length >= 120 ? text.slice(0, 4000) : null
}

async function fetchReleaseHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/*
 * Kutsutaan vain vielä näkemättömille ehdokkaille (legacyFetchCollector),
 * joten yksi sivuhaku per uusi tiedote.
 */
export async function enrichPeabCandidate(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  const html = await fetchReleaseHtml(candidate.source_url)
  if (!html) return candidate

  const body = extractPeabBody(html)
  if (!body) return candidate

  /*
   * Peab on tiedotteen julkaisija ja käytännössä aina urakoitsija.
   * Rakennuttaja otetaan tekstistä löytyvästä tilaajasta.
   *
   * JOS TILAAJAA EI LÖYDY, rakennuttaja jää tyhjäksi - ei Peabiksi.
   * resolveParties palauttaisi oletuksena julkaisijan, mikä on oikein
   * yleisessä STT-tapauksessa mutta väärin tässä: kun urakoitsija on jo
   * tiedossa, saman yrityksen kirjaaminen myös rakennuttajaksi väittäisi
   * hanketta omaperusteiseksi. Mitattu: Evijärven koulun tilaaja on kunta
   * ja atNorthin datakeskuksen atNorth, mutta molempiin oli tulossa Peab.
   *
   * Poikkeus on aito omaperusteinen tuotanto, jonka teksti kertoo - silloin
   * Peab on molempia.
   */
  const parties = resolveParties("Peab", candidate.name, body)
  const client = parties.builder ? parties.developer : null
  const ownDevelopment = OWN_DEVELOPMENT.test(body)

  return {
    ...candidate,
    description: body,
    city: candidate.city ?? detectCityFromText(body),
    location: candidate.location ?? extractStreetAddress(body),
    developer: client ?? (ownDevelopment ? "Peab" : null),
    builder: "Peab",
    phase: inferPeabPhase(candidate.name, body),
    estimated_completion:
      candidate.estimated_completion ?? parseEstimatedCompletionDate(body),
  }
}

export async function fetchPeabSource() {
  const results: any[] = []
  const seenUrls = new Set<string>()

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 1; page <= 5; page++) {
    const url =
      page === 1
        ? `${BASE}/peab/ajankohtaista/`
        : `${BASE}/peab/ajankohtaista/?page=${page}`

    const res = await fetch(url)
    if (!res.ok) break

    const html = await res.text()
    const $ = cheerio.load(html)

    $("a").each((_, el) => {
      const title = $(el).text().trim()
      const href = $(el).attr("href")
      if (!title || !href) return

      const absoluteHref = href.startsWith("http") ? href : `${BASE}${href}`
      if (!absoluteHref.includes("/peab/media/tiedotteet/")) return
      if (/^\d+$/.test(title)) return

      const lowerTitle = title.toLowerCase()
      if (!PROJECT_KEYWORDS.some((k) => lowerTitle.includes(k))) return
      if (EXCLUDE_KEYWORDS.some((k) => lowerTitle.includes(k))) return

      const dateMatch = $(el).text().match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
      if (dateMatch) {
        const [day, month, year] = dateMatch[1].split(".").map(Number)
        if (new Date(year, month - 1, day) < cutoffDate) return
      }

      if (seenUrls.has(absoluteHref)) return
      seenUrls.add(absoluteHref)

      const completed = COMPLETED_KEYWORDS.some((k) => lowerTitle.includes(k))

      results.push({
        name: title,
        description: null,
        city: detectCityFromText(title),
        region: null,
        location: null,
        /*
         * Otsikkopohjainen arvaus. enrich() korvaa tämän leipätekstistä
         * pääteltävällä vaiheella; tämä jää voimaan vain jos sivuhaku
         * epäonnistuu tai täydennysbudjetti loppuu kesken.
         */
        phase: inferPeabPhase(title, null),
        builder: "Peab",
        source_url: absoluteHref,
        confidence: 0.6,
        completed,
        source_name: "peab",
      })
    })
  }

  return results
}
