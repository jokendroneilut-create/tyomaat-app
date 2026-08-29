import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * LUJATALON REFERENSSIT — projektisivut, ei uutisia.
 *
 * Sama malli kuin Skanskan projektisivuilla, mutta rikkaampi: Lujatalo on
 * ainoa mitattu lähde, joka erottaa TILAAJAN ja RAKENNUTTAJAN toisistaan
 * ja kertoo lisäksi urakan euromääräisen osuuden. Mitattu 19.8.2026: 115
 * referenssiä yhdellä sivulla, ei sivutusta.
 *
 * KENTÄT LUETAAN DOM-RAKENTEESTA, EI TEKSTISTÄ. Sivun "Projektin tiedot"
 * -osio on <h3>otsikko</h3><p>arvo</p> -pareja. Pelkkä tekstipoiminta ei
 * toimi, koska cheerio yhdistää elementit ilman erottimia — silloin
 * "Rakennuttaja" ja arvo sulautuvat yhdeksi merkkijonoksi
 * ("RakennuttajaPäijät-Hämeen hyvinvointialue").
 */

const LISTING_URL = "https://www.lujatalo.fi/referenssit/"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/*
 * Kortti kertoo tilan sanoin tai pelkkänä vuosilukuna. Sivusto erottaa ne
 * itse, joten vaihetta ei tarvitse arvata: "Rakentaminen käynnissä" on
 * käynnissä, pelkkä vuosiluku on valmistunut referenssi.
 */
const ONGOING = /rakentaminen käynnissä|käynnissä/i

export function parseLujataloCard(cardText: string): {
  city: string | null
  ongoing: boolean
} {
  const [head] = cardText.split(/\s+–\s+/)
  const rest = cardText.slice(head?.length ?? 0)

  return {
    city: head?.trim() ? detectCityFromText(head.trim()) : null,
    ongoing: ONGOING.test(rest.slice(0, 60)),
  }
}

export async function fetchLujataloProjectsSource() {
  const response = await fetch(LISTING_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const $ = cheerio.load(await response.text())

  const seen = new Set<string>()
  const results: any[] = []

  $('a[href*="/referenssit/"]').each((_, el) => {
    const href = $(el).attr("href") ?? ""

    /* Listaussivu itse ja sertifikaattisivu eivät ole hankkeita. */
    if (/\/referenssit\/?$/.test(href) || href.includes("sertifikaatit")) return

    const url = href.startsWith("http") ? href : `https://www.lujatalo.fi${href}`
    if (seen.has(url)) return
    seen.add(url)

    /*
     * Linkki itse on "Lue lisää" -painike, joten otsikko haetaan kortin
     * juuresta ylöspäin kulkemalla.
     */
    let node = $(el)
    let title = ""
    let cardText = ""

    for (let up = 0; up < 6 && !title; up++) {
      node = node.parent()
      const heading = node.find("h1,h2,h3,h4").first()
      if (heading.length) {
        title = heading.text().replace(/\s+/g, " ").trim()
        cardText = node.text().replace(/\s+/g, " ").trim()
      }
    }

    if (!title) return

    const card = parseLujataloCard(cardText)

    /*
     * VALMISTUNEET REFERENSSIT JÄTETÄÄN POIS.
     *
     * Mitattu 19.8.2026: 115 referenssistä 108 on valmistuneita. Ne eivät
     * ole mahdollisuuksia vaan historiaa, ja katselmointijonoon tuotuina ne
     * hukuttaisivat alleen ne seitsemän jotka ovat käynnissä.
     *
     * Sama mittaus osoitti myös, että rakenteiset kentät ovat harvassa:
     * 25 sivun otoksesta tilaaja tai rakennuttaja löytyi vain kolmelta.
     * Lähteen arvo on siis käynnissä olevissa kohteissa, ei kenttien
     * kattavuudessa.
     */
    if (!card.ongoing) return

    results.push({
      name: title,
      city: card.city,
      region: null,
      location: null,
      phase: card.ongoing ? PHASE_LABELS.construction : PHASE_LABELS.completed,
      source_url: url,
      confidence: 0.7,
      completed: !card.ongoing,
      source_name: "lujatalo_projektit",
    })
  })

  return results
}

/*
 * RAKENTAMISEN AIKATAULU REFERENSSISIVULTA.
 *
 * Listasivu merkitsee kohteen kaynnissa olevaksi, mutta merkinta voi olla
 * vanhentunut: "Varkauden Sote-keskus" tuli jonoon rakenteilla olevana
 * vaikka kohdesivulla lukee "Rakentamisen aikataulu 2019 - 2021".
 *
 * Kohdesivun oma aikataulu on luotettavampi kuin listauksen merkinta,
 * koska se on hankkeen tieto eika listauksen tila.
 *
 * Hyvaksytaan vain nelinumeroiset vuodet: "2019 - 2021", "2024-2026" ja
 * ajatusviivalla "2024–2026". Avoin loppu ("2025-") jatetaan, koska
 * siita ei voi paatella valmistumista.
 */
export function parseLujataloSchedule(
  value: string | null | undefined
): { start: number; end: number } | null {
  const m = String(value ?? "").match(/\b(19|20)(\d{2})\s*[-–—]\s*(19|20)(\d{2})\b/)
  if (!m) return null

  const start = Number(`${m[1]}${m[2]}`)
  const end = Number(`${m[3]}${m[4]}`)
  if (end < start) return null

  return { start, end }
}

/* "71 M€" -> 71000000. Muut muodot jätetään, jottei arvata väärin. */
export function parseMillionEuros(value: string): number | null {
  const match = value.replace(",", ".").match(/([\d.]+)\s*M€/i)
  if (!match) return null

  const millions = Number(match[1])
  return Number.isFinite(millions) && millions > 0 ? Math.round(millions * 1_000_000) : null
}

/*
 * LOHKOTEKSTI, EI $("body").text().
 *
 * Cheerion .text() liittaa peräkkäisten elementtien tekstit ILMAN
 * erotinta. Siitä syntyi kaksi vikaa samasta juuresta (havaittu
 * 29.8.2026, Wärtsilä STH HUB Extension):
 *
 *   otsikko liimautui leipätekstiin  "...ExtensionLujatalo toteuttaa..."
 *   linkkilista kuvauksen loppuun    "...kanssa:https://...https://..."
 *
 * Siksi teksti kootaan lohkoelementeittäin ja pelkät osoitteet
 * pudotetaan: linkkilista ei ole hankkeen kuvausta.
 */
export function blockText($: any): string {
  const palat: string[] = []

  $("h1, h2, h3, h4, p, li, td, th, blockquote").each((_: any, el: any) => {
    const teksti = $(el).text().replace(/\s+/g, " ").trim()
    if (!teksti) return
    /* Pelkkä osoite tai osoitejono ei ole kuvausta. */
    if (/^(?:https?:\/\/\S+\s*)+$/i.test(teksti)) return
    palat.push(teksti)
  })

  return palat.join(" ").replace(/\s+/g, " ").trim()
}

/*
 * "Hankkeen laajuus on noin 11 000 bruttoneliömetriä".
 *
 * Lujatalon kohdesivulla on yleensä rakenteinen Laajuus-kenttä, mutta
 * ei aina - Wärtsilän laajennuksessa luku oli vain leipätekstissä,
 * jolloin se jäi kokonaan poimimatta.
 *
 * Tuhaterotin sallitaan vain kolmen numeron ryhmissä, jottei luku hyppää
 * kahden luvun yli (sama ansa kuin asuntosäätiöpoimijassa).
 */
export function parseScopeFromText(text: string): string | null {
  const m =
    /(?<!\d)(\d{1,3}(?:\s\d{3})*)\s*(bruttoneliömetri[aä]?|brm2|brm²|kerrosneliömetri[aä]?|k-m2|neliömetri[naä]?)/i.exec(
      String(text ?? "")
    )
  if (!m) return null

  const luku = Number(m[1].replace(/\s/g, ""))
  if (!Number.isFinite(luku) || luku <= 0) return null

  return `${m[1].trim()} ${m[2]}`
}

/*
 * Linkkilistan poiston jalkeen sen otsikko jaa roikkumaan:
 * "...vuonna 2025. Lisaa yhteistyohankkeista Wartsilan kanssa:".
 * Kaksoispisteeseen paattyva viimeinen katkelma ei kerro mitaan ilman
 * listaa, joten se karsitaan.
 */
export function trimDanglingLabel(text: string): string {
  return String(text ?? "")
    .replace(/(?:^|(?<=[.!?]))\s*[^.!?]{0,90}:\s*$/, "")
    .trim()
}

export async function enrichLujataloProject(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  const response = await fetch(candidate.source_url, { headers: { "User-Agent": UA } })
  if (!response.ok) return candidate

  const $ = cheerio.load(await response.text())
  $("script, style, noscript, nav, header, footer").remove()

  /* Kenttäparit: <h3>otsikko</h3> jota seuraa <p>arvo</p>. */
  const fields = new Map<string, string>()

  $("h3").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim()
    const value = $(el).next("p").text().replace(/\s+/g, " ").trim()
    if (label && value) fields.set(label.toLowerCase(), value)
  })

  const developer = fields.get("rakennuttaja") ?? fields.get("tilaaja") ?? null
  const contractForm = fields.get("urakkamuoto") ?? fields.get("hankemuoto") ?? null
  const scope = fields.get("laajuus") ?? null
  const costText = fields.get("rakentamisen osuus m€") ?? null
  const aikatauluTeksti = fields.get("rakentamisen aikataulu") ?? null
  const aikataulu = parseLujataloSchedule(aikatauluTeksti)

  const body = blockText($)
  const detailsAt = body.search(/Projektin tiedot/i)
  const description = trimDanglingLabel(
    (detailsAt > 0 ? body.slice(0, detailsAt) : body)
      .split(/Sinua saattaisi kiinnostaa/i)[0]
      .trim()
  )

  const scopeFromText = parseScopeFromText(description)
  const cost = costText ? parseMillionEuros(costText) : null

  /*
   * KOHDESIVUN AIKATAULU VOITTAA LISTAUKSEN MERKINNÄN.
   *
   * Listaus merkitsi "Varkauden Sote-keskuksen" käynnissä olevaksi, mutta
   * kohdesivulla lukee "Rakentamisen aikataulu 2019 - 2021". Merkintä oli
   * siis vanhentunut, ja valmis kohde tuli jonoon rakenteilla olevana.
   *
   * Aikataulu on hankkeen oma tieto, listauksen merkintä vain listauksen
   * tila — siksi aikataulu ratkaisee. Päättyneestä vuodesta tehdään
   * valmistumispäivä (vuoden viimeinen päivä, kuten muissakin
   * arvioissa), jolloin hanke tunnistetaan valmistuneeksi.
   */
  const paattynyt =
    aikataulu != null && aikataulu.end < new Date().getUTCFullYear()

  return {
    ...candidate,
    description: description.slice(0, 4000),
    city: candidate.city ?? detectCityFromText(description),
    location: candidate.location ?? extractStreetAddress(description),
    developer: candidate.developer ?? developer,
    /* Julkaisija on pääurakoitsija omilla referenssisivuillaan. */
    builder: candidate.builder ?? "Lujatalo",
    property_type: candidate.property_type ?? inferBuildingType(candidate.name, description),
    ...(cost ? { estimated_cost: cost } : {}),
    ...(aikataulu ? { estimated_completion: `${aikataulu.end}-12-31` } : {}),
    ...(paattynyt ? { phase: PHASE_LABELS.completed, completed: true } : {}),
    metadata: {
      ...(candidate.metadata ?? {}),
      ...(cost ? { cost_source: "text" } : {}),
      ...(contractForm ? { urakkamuoto: contractForm } : {}),
      /* Rakenteinen kenttä ensin, leipäteksti varalla. */
      ...(scope || scopeFromText ? { laajuus: scope ?? scopeFromText } : {}),
      ...(aikatauluTeksti ? { rakentamisen_aikataulu: aikatauluTeksti } : {}),
      field_sources: {
        developer: developer ? "teksti" : null,
        builder: "julkaisija",
        /* Aikataulu on tarkempi kuin listauksen merkintä. */
        phase: paattynyt ? "aikataulu" : "lähde",
        city: candidate.city ? "lähde" : "teksti",
        estimated_cost: cost ? "teksti" : null,
        laajuus: scope ? "lähde" : scopeFromText ? "teksti" : null,
      },
    },
  }
}
