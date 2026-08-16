import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * SITOWISE — ENSIMMÄINEN SUUNNITTELUTOIMISTOLÄHDE.
 *
 * MIKSI SUUNNITTELIJA EIKÄ URAKOITSIJA. Suunnittelija valitaan hankkeen
 * alussa, joten sen tiedote tulee ennen urakkakilpailua. Ennen kaikkea se
 * yltää sinne minne lupa- ja hankintalähteet eivät: yksityisiin
 * suurhankkeisiin, jotka eivät näy Hilmassa, päätöksissä eivätkä kaavoissa
 * (mitattu 16.8.2026: LUMI AI Factory -datakeskus, 26 energiavarastoa).
 *
 * MIKSI NIMENOMAAN UUTISET EIKÄ REFERENSSIT. Suunnittelutoimistojen
 * referenssisivut ovat markkinointia ja katsovat taaksepäin: otos WSP:n
 * kymmenestä projektisivusta 16.8.2026 antoi 7 valmista ja 2 käynnissä
 * olevaa. Uutis- ja sijoittajatiedotteet kertovat päinvastoin juuri
 * alkavasta työstä. Siksi tämä lähde lukee ne, ei referenssejä.
 *
 * MIKSI EI RSS. Sitowisen syöte osoitteessa /fi/rss.xml on olemassa mutta
 * hylätty: 10 juttua ja tuorein 13.8.2025 eli vuoden vanha (todettu
 * 16.8.2026), vaikka sivusto julkaisee yhä. Listaussivut ovat palvelimen
 * renderöimää HTML:ää ja ajan tasalla.
 */

const LISTINGS = [
  /* Uutiset. Polku ohjautuu Drupalin node-tunnukseen, joten seurataan ohjaus. */
  "https://www.sitowise.com/fi/ajankohtaista",
  /*
   * Sijoittajauutiset ovat hankkeiden kannalta se arvokkaampi puoli:
   * pörssiyhtiö tiedottaa voitetut toimeksiannot nimeltä ja ajallaan.
   */
  "https://www.sitowise.com/fi/sijoittajauutiset",
]

const UA = "Mozilla/5.0 (compatible; TyomaatBot/1.0; +https://tyomaat.fi)"

/*
 * Hankkeen merkit. Vähintään yksi vaaditaan, koska listauksella on paljon
 * asiantuntija-artikkeleita ("Miksi Suomi on hyvä paikka datakeskukselle?"),
 * jotka eivät ole hankkeita vaikka puhuvat rakentamisesta.
 */
const PROJECT_KEYWORDS = [
  "hanke",
  "hankkeen",
  "hankkeess",
  "ratikka",
  "ratikan",
  "ratasuunnitelma",
  "rata",
  "radan",
  "silta",
  "sillat",
  "tunneli",
  "sairaala",
  "koulu",
  "päiväkoti",
  "uimahalli",
  "kortteli",
  "keskusta-alue",
  "terminaali",
  "datakeskus",
  "tehdas",
  "voimala",
  "laitos",
  "urakka",
  "urakan",
  "osatilaus",
  "suunnitteluryhmä",
  "suunnittelijat",
  "suunnitelman",
  "asemakaava",
  "yleissuunnitelma",
  "toteutusvaihe",
  "rakentaminen",
  "rakennetaan",
  "peruskorjaus",
  "allianssi",
]

/*
 * Pörssiyhtiön tiedotevirta on enimmäkseen talousraportointia. Nämä eivät
 * ole hankkeita, ja ilman suodatinta ne täyttäisivät jonon: mitattu
 * 16.8.2026 sijoittajauutisten 34 otsikosta 9 oli katsauksia tai
 * uutiskirjeitä.
 */
const EXCLUDE_KEYWORDS = [
  "uutiskirje",
  "hiljaista jaksoa",
  "osavuosikatsaus",
  "puolivuosikatsaus",
  "tilinpäätös",
  "pörssitiedote",
  "liputusilmoitus",
  "yhtiökokous",
  "hallituksen",
  "nimitys",
  "toimitusjohtaja",
  "vuosikertomus",
  "osakkeen",
  "strategia",
  "tytäryhtiö",
  "katso tallenne",
  "webinaari",
  "blogi",
  "rekry",
]

/*
 * Ulkomaiset toimeksiannot. Sitowise toimii Ruotsissa ja EU-hankkeissa, ja
 * niitä on tiedotteissa runsaasti — mutta palvelu on Suomen työmaista.
 * Ilman tätä kannassa olisi hankkeita joita kukaan käyttäjä ei voi myydä.
 */
const FOREIGN_KEYWORDS = [
  "ruotsi",
  "göteborg",
  "tukholma",
  "norja",
  "tanska",
  "viro",
  "trafikverket",
  "eu:n",
  "euroopan",
]

/* Otsikosta luettava valmistuminen — sama sääntö kuin yrityslähteillä. */
const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "toteutti", "avattiin"]

export function isSitowiseProjectItem(title: string): boolean {
  const t = title.toLowerCase()
  if (EXCLUDE_KEYWORDS.some((k) => t.includes(k))) return false
  if (FOREIGN_KEYWORDS.some((k) => t.includes(k))) return false
  return PROJECT_KEYWORDS.some((k) => t.includes(k))
}

async function fetchListing(url: string): Promise<{ title: string; href: string }[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  })

  if (!response.ok) return []

  const $ = cheerio.load(await response.text())
  const items: { title: string; href: string }[] = []

  $('a[href*="/fi/uutiset/"], a[href*="/fi/sijoittajauutinen/"]').each((_, el) => {
    const href = $(el).attr("href")
    const title = $(el).text().replace(/\s+/g, " ").trim()

    /*
     * Lyhyt ankkuriteksti on kuvalinkki tai "Lue lisää", ei otsikko.
     * Sama juttu esiintyy listalla kahdesti (kuva + otsikko).
     */
    if (!href || title.length < 15) return

    items.push({
      title,
      href: href.startsWith("http") ? href : `https://www.sitowise.com${href}`,
    })
  })

  return items
}

export async function fetchSitowiseSource() {
  const seen = new Set<string>()
  const results: any[] = []

  for (const listing of LISTINGS) {
    let items: { title: string; href: string }[] = []

    try {
      items = await fetchListing(listing)
    } catch (error: any) {
      console.error(`sitowise: ${listing} epäonnistui:`, error?.message ?? error)
      continue
    }

    for (const item of items) {
      if (seen.has(item.href)) continue
      seen.add(item.href)

      if (!isSitowiseProjectItem(item.title)) continue

      const completed = COMPLETED_KEYWORDS.some((k) =>
        item.title.toLowerCase().includes(k)
      )

      results.push({
        name: item.title,
        city: detectCityFromText(item.title),
        region: null,
        location: null,
        /*
         * Suunnittelijan tiedote kertoo suunnittelun alusta, ei urakan
         * myöntämisestä. Rikastus tarkentaa vaiheen leipätekstistä.
         */
        phase: completed ? PHASE_LABELS.completed : PHASE_LABELS.planning,
        source_url: item.href,
        confidence: 0.6,
        completed,
        source_name: "sitowise",
      })
    }
  }

  return results
}
