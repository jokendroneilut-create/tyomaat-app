import * as cheerio from "cheerio"
import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import {
  extractBuilderFromText,
  extractClientFromText,
  extractExplicitClient,
} from "./fetchSttHakuSource"
import { NAME, cleanCompanyName } from "./companyName"
import { LEAD_LENGTH, inferBuildingType } from "./buildingType"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { sivuurakoitsijanVaihe } from "./sivuurakoitsijaRss"

/*
 * VRJ: AJANKOHTAISTA (D-250).
 *
 * Johannes 8.10.2026 kuvakaappauksin: Elmo Areena (Vantaa) puuttui
 * kannasta, vaikka VRJ:n oma tiedote kertoo rakennuttajan (Elmon
 * Urheilukeskus Kiinteistoosakeyhtio), laajuuden (7 710 brm2),
 * aikataulun (valmis toukokuussa 2027) ja kaksi nimettya yhteyshenkiloa
 * puhelinnumeroineen.
 *
 * EI RSS:AA, EI REST-RAJAPINTAA. Sivusto on oma julkaisujarjestelma;
 * sitemap (`MAPINDEX.xml`) listaa jutut mutta antaa vain muokkauspaivan.
 * Listaussivu (`ajankohtaista.html?p366=N`, viisi juttua sivulla) antaa
 * otsikon ja osoitteen, julkaisupaiva on jutun sivulla
 * `article:published_time`-metatagissa. robots.txt kieltaa vain
 * `/media/forms`.
 *
 * MITATTU 8.10.2026: 47 juttua (3/2024 - 10/2026), viimeisen 12
 * kuukauden sisalla 10, joista 4 on rakennushanke:
 *
 *   21.5.2026  Holiday Club Saariselan kylpylan peruskorjaus
 *  30.4.2026   Elmo Areena, Vantaa
 *   8.1.2026   Vt 20 Kuusamontien liikennejarjestelyt, Kiiminki (valmis)
 *  24.10.2025  Kiimingin Koitelin virkistys- ja pysakointialue
 *
 * Loput kuusi ovat omistusjarjestelyja, nimenmuutoksia, juhlavuosia ja
 * vastuullisuusraportteja. Koko 47:n joukossa noin puolet on hankkeita.
 */

const BASE = "https://www.vrj.fi"
const LISTA = `${BASE}/ajankohtaista.html`

/* Viisi juttua sivulla; nelja sivua kattaa mitatulla tahdilla 12+ kk. */
const MAX_SIVUT = 6

const OTSAKKEET = { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" }

/*
 * SUODATIN POISTAA VAIN SEN MIKA EI KOSKAAN OLE HANKE (D-247).
 *
 * Hankeotsikot ovat VRJ:lla liian vaihtelevia termilistalle:
 * "Kiimingin Koitelin alueella kaynnistyy virkistys- ja pysakointialueen
 * peruskorjaus" ei mainitse VRJ:ta eika urakkaa. Poissulku on mitattu
 * kaikilla 47 otsikolla; jokainen termi vastaa ainakin yhta mitattua
 * ei-hanketta.
 *
 * POISSULKU KATSOO VAIN OTSIKKOA (D-236, D-241).
 */
const EI_KOSKAAN_HANKE = [
  /* Yhtio- ja henkilouutiset */
  "omistusjärjestely",
  "omistusjarjestely",
  "toimitusjohtaja",
  "nimitetty",
  "nimitys",
  "vaihtaa nimeä",
  "vaihtaa nimea",
  "avainlippu",
  "vuotta!",
  "vastuullisuusraport",
  "hiilineutraal",
  "kirjana",
  "ansiomerk",
  "siltaluokitu",
  "hinnasto",
  "ajoneuvo",
  "koulutuksessa",
  /* Rekrytointi ja tapahtumat */
  "rekry",
  "työpaikkoja",
  "tyopaikkoja",
  "tavattavissa",
  "tapahtuma",
  "yritysvierailu",
  /* Tervehdykset ja hyvantekevaisyys */
  "toivottaa",
  "joulu",
  "orvoki",
]

/*
 * Valmistuminen otsikon menneesta aikamuodosta. companyRelease ei tunne
 * muotoja "toteutti" ja "sai valmiiksi", joten lahde merkitsee ne itse;
 * importCandidate lukee `completed`-kentan rikastuksen ohi.
 */
const VALMIS_OTSIKOSSA = ["toteutti", "sai valmiiksi", "valmistui", "valmistunut", "luovutettiin"]

/* Suodatus erillaan hausta, jotta sen voi mitata ilman verkkoa. */
export function lapaiseeSuodatuksen(otsikko: string): boolean {
  const pieni = otsikko.toLowerCase()
  return !EI_KOSKAAN_HANKE.some((k) => pieni.includes(k))
}

export type VrjLinkki = { title: string; link: string }
export type VrjJuttu = VrjLinkki & { date: Date | null; teksti: string }

/* Listaussivun jasennys erillaan hausta testia varten. */
export function jasennaLista(html: string): VrjLinkki[] {
  const $ = cheerio.load(html)
  const out: VrjLinkki[] = []
  $("main h2 a[href*='/ajankohtaista/']").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim()
    const href = $(el).attr("href") ?? ""
    if (!title || !href) return
    out.push({ title, link: href.startsWith("http") ? href : `${BASE}${href}` })
  })
  return out
}

/*
 * Jutun sivu: julkaisupaiva metatagista ja teksti <main>-elementista.
 * Otsikko (<h1>) ja tunnisteet ("Rakennusala Tiedote VRJ") ovat mainin
 * alussa; ne poistetaan elementteina, jottei kuvaus ala niilla.
 * "Takaisin"-linkki on lopussa.
 *
 * Otsikkoa EI leikata tekstin alusta merkkijonona: Koitelin jutun
 * ensimmainen virke alkaa samoin sanoin kuin otsikko, ja leikkaus vei
 * siita alun — kuvaus alkoi "maanantaina 27.10.2025." (kuivaharjoitus).
 */
export function jasennaJuttu(html: string): { date: Date | null; teksti: string } {
  const $ = cheerio.load(html)
  const meta = $('meta[property="article:published_time"]').attr("content")
  const date = meta ? new Date(meta) : null

  const main = $("main").first()
  main.find("script, style, noscript, nav, h1, .MediaObject__Label, img").remove()
  main.find("p, h2, h3, li, div, br").each((_, el) => {
    $(el).append(" ")
  })
  let teksti = main.text().replace(/\s+/g, " ").trim()
  teksti = teksti.replace(/^Ajankohtaista\s+/, "")
  teksti = teksti.replace(/\s*Takaisin\s*$/, "").trim()

  return { date: date && !isNaN(date.getTime()) ? date : null, teksti }
}

async function haeHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: OTSAKKEET, cache: "no-store" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/*
 * Kaikki jutut aikarajaan asti, suodattamatta. Lista on uusin ensin, joten
 * haku lopetetaan ensimmaiseen aikarajaa vanhempaan juttuun.
 */
export async function haeVrjJutut(aikaraja: Date = tiedotteenAikaraja()): Promise<VrjJuttu[]> {
  const out: VrjJuttu[] = []

  for (let sivu = 1; sivu <= MAX_SIVUT; sivu++) {
    const html = await haeHtml(sivu === 1 ? LISTA : `${LISTA}?p366=${sivu}`)
    if (!html) break

    const linkit = jasennaLista(html).filter((l) => !out.some((o) => o.link === l.link))
    if (linkit.length === 0) break

    let liianVanha = false
    for (const linkki of linkit) {
      const juttu = await haeHtml(linkki.link)
      if (!juttu) continue
      const { date, teksti } = jasennaJuttu(juttu)
      if (date && date < aikaraja) {
        liianVanha = true
        break
      }
      out.push({ ...linkki, date, teksti })
    }
    if (liianVanha) break
  }

  return out
}

/*
 * TIEN NIMI EI OLE KAUPUNKI. "Valtatie 20 Kuusamontien
 * liikennejarjestelyt Kiimingissa" sai kaupungiksi Kuusamon, vaikka
 * tyomaa on Oulun Kiimingissa (kuivaharjoitus 8.10.2026). Tienimet
 * poistetaan ennen tunnistusta; tyhja kaupunki on parempi kuin vaara.
 */
export function ilmanTienNimia(teksti: string): string {
  return teksti
    /* "siirtamalla liittymaa Kuusamon suuntaan" on suunta, ei sijainti. */
    .replace(/[\p{L}-]+n\s+(?:suuntaan|suunnasta|suunnalla)/giu, " ")
    .replace(/[\p{L}-]+(?:tie|tien|tiellä|tielle|tieltä|katu|kadun|kadulla|kadulle)(?![\p{L}])/giu, " ")
}

/*
 * Rakennuttaja VRJ:n omalla sanamuodolla: "Jaahallihankkeesta vastaa
 * Elmon Urheilukeskus Kiinteistoosakeyhtio". Yhteiset kuviot
 * (`extractClientFromText`) eivat tunne sita, ja Elmo Areena jai
 * kuivaharjoituksessa ilman rakennuttajaa.
 */
const HANKKEESTA_VASTAA = new RegExp(`hankkeesta\\s+vastaa\\s+(${NAME})`)

export function vrjRakennuttaja(otsikko: string, teksti: string): string | null {
  const lead = teksti.slice(0, LEAD_LENGTH)
  const osuma = teksti.match(HANKKEESTA_VASTAA)?.[1]
  const omaKuvio = osuma ? cleanCompanyName(osuma.split(/(?<!(?:^|\s)[A-ZÄÖÅ])\.\s+/)[0]) : null
  const nimi =
    extractClientFromText(otsikko, lead) ?? extractExplicitClient(teksti) ?? omaKuvio
  if (!nimi || /^vrj(?![\p{L}])/iu.test(nimi)) return null
  return nimi
}

/*
 * EI createCompanyEnricheria, vaikka VRJ on paaurakoitsija kuten Kastelli.
 * Kuivaharjoitus 8.10.2026 nayttti miksi: rikastus hakee sivun uudelleen
 * ja korvaa kuvauksen `extractReleaseBody`-tekstilla, joka alkaa
 * "Ajankohtaista <otsikko> Rakennusala Tiedote VRJ" — sivun kalusteilla.
 * Lisaksi se kirjoitti vaiheen yli: Vt 20:n "VRJ toteutti" palasi
 * suunnitteluvaiheeseen. Jutun sivu on jo haettu, joten kentat
 * paatellaan tassa samoilla yhteisilla apufunktioilla ilman toista hakua.
 */
const URAKOITSIJA_NIMETTY = /[Uu]rakoitsijana\s+toimii\s+VRJ|on\s+valittu\s+\p{L}*urakoitsijaksi/u

export function vrjEhdokas(juttu: VrjJuttu) {
  const otsikko = juttu.title.toLowerCase()
  const lead = juttu.teksti.slice(0, LEAD_LENGTH)

  const completed =
    VALMIS_OTSIKOSSA.some((k) => otsikko.includes(k)) ||
    sivuurakoitsijanVaihe(juttu.title, lead) === PHASE_LABELS.completed
  /*
   * "Urakoitsijana toimii VRJ Etela-Suomi Oy" (Koitelin peruskorjaus)
   * kertoo sopimuksen olevan tehty, vaikka otsikko ei sita sano.
   */
  const yleinenVaihe = sivuurakoitsijanVaihe(juttu.title, lead)
  const phase = completed
    ? PHASE_LABELS.completed
    : yleinenVaihe === PHASE_LABELS.planning && URAKOITSIJA_NIMETTY.test(lead)
      ? PHASE_LABELS.contract_awarded
      : yleinenVaihe

  /*
   * ENSIMMAINEN VIRKE ENNEN KOKO INGRESSIA. `detectCityFromText` ei
   * katso sijaintia vaan kuntaluettelon jarjestysta: Elmo Areenan ingressi
   * alkaa "Vantaalle Asolan kaupunginosaan", mutta mainitsee myohemmin
   * "Helsingin Herttoniemen ja Kivikon jaahallit" — ja tulos oli Helsinki.
   */
  const ensimmainenVirke = lead.split(/(?<=[.!?])\s+/)[0] ?? ""
  const city =
    detectCityFromText(ilmanTienNimia(otsikko)) ??
    detectCityFromText(ilmanTienNimia(ensimmainenVirke.toLowerCase())) ??
    detectCityFromText(ilmanTienNimia(lead.toLowerCase()))

  /*
   * Paaurakoitsija on VRJ, ellei teksti nimea toista: VRJ voi olla myos
   * aliurakoitsija ("VRJ mukana ... -hankkeessa").
   */
  const nimetty = extractBuilderFromText(juttu.title, lead)
  const builder = nimetty && !/^vrj(?![\p{L}])/iu.test(nimetty) ? nimetty : "VRJ"

  return {
    name: juttu.title,
    description: juttu.teksti || null,
    city,
    region: city ? getMunicipalityByName(city)?.region ?? null : null,
    location: extractStreetAddress(juttu.teksti),
    developer: vrjRakennuttaja(juttu.title, juttu.teksti),
    builder,
    phase,
    completed,
    property_type: inferBuildingType(juttu.title, juttu.teksti),
    estimated_completion: parseEstimatedCompletionDate(
      juttu.teksti,
      juttu.date ? juttu.date.toISOString() : null
    ),
    source_url: juttu.link,
    confidence: 0.6,
    source_name: "vrj",
    metadata: {
      related_companies: mergeCompanyNames([], builder === "VRJ" ? ["VRJ"] : ["VRJ", builder]),
    },
  }
}

export async function fetchVrjSource() {
  const jutut = await haeVrjJutut()
  return jutut.filter((j) => lapaiseeSuodatuksen(j.title)).map(vrjEhdokas)
}
