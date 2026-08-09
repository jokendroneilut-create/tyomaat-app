import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { extractDecisionWinners } from "./decisionWinners"
import { inferDecisionPhase, phaseFromTitle } from "./decisionPhase"
import { decodeHtmlEntities } from "./htmlEntities"
import { CONSTRUCTION_SIGNALS } from "./fetchDynastySource"

/*
 * CaseM-päätösjärjestelmä (cloudnc.fi), käytössä mm. Tampereella.
 *
 * Kolmas alustaperhe Ahjon ja Dynastyn rinnalle, ja kattaa saman vaiheen:
 * kunnan nimetyn investointipäätöksen.
 *
 * ENUMEROINTI OLI TÄSSÄ SE VAIKEA OSA. Alustalla ei ole RSS:ää eikä
 * JSON-rajapintaa, ja toimielinlistaus antaa vain 15 tuoreinta asiaa. Sivusto
 * on ASP.NET WebForms ja haku on postback, mutta postback OHJAA tavalliseen
 * GET-osoitteeseen joka toimii ilman istuntoa. Osoite löytyi vasta ajamalla
 * haku selaimessa - arvailu epäonnistui kahdesta syystä yhtä aikaa: polku on
 * "haku" pienellä ja hakusana on "s", ei "searchtext".
 */

const RESULTS_PER_PAGE = 20
const MAX_PAGES_PER_TERM = 5
const MAX_DETAIL_FETCHES_PER_RUN = 60
const RECENCY_MONTHS = 18

/*
 * Hakusanat ovat Dynastyn CONSTRUCTION_SIGNALS-listan ydin. Ne on jo mitattu
 * toimiviksi kuuden kunnan aineistolla, joten niitä ei arvata uudelleen.
 * Lista on lyhyempi kuin Dynastyssa, koska tässä jokainen sana on oma
 * hakunsa: sanoja on hinta, ei suodatin.
 */
const SEARCH_TERMS = [
  "hankesuunnitelma",
  "tarveselvitys",
  "toteutussuunnitelma",
  "uudisrakennus",
  "peruskorjaus",
  "perusparannus",
  "urakkasopimus",
  "purku-urakka",
]

const EXCLUDE_PATTERNS = [
  /\blausunto/i,
  /oikaisuvaatimu/i,
  /valtuustoaloit/i,
  /kuntalaisaloit/i,
  /viranhaltijoiden\s+päätökset/i,
  /*
   * Alla olevat lisattiin kolmen uuden kunnan mittauksesta. Jokainen on
   * otsikkotyyppi joka lapaisee positiivisen listan mutta ei ole hanke.
   */
  // Toimielinten nimitysasiat: "Nuorisovaltuuston jasenen nimeaminen Zillarin
  // nuorisotilan tarveselvitystyoryhmaan" (Rovaniemi, kolme osumaa).
  /jäsenen\s+nimeämi/i,
  /jäsenen\s+valinta/i,
  /työryhmän\s+nimeämi/i,
  /\bedustaja(n|ksi)?\b/i,
  // Kunnossapito, ei rakentaminen: "Ita-Porin aurausurakka",
  // "Pohjois-Porin nurmikoiden ja puhtaanapidon hoitourakka" (Pori).
  /hoitourakka/i,
  /auraus/i,
  /puhtaanapi/i,
  // Rakennuslupatason poikkeamiset, tyypillisesti yksittainen omakotitalo.
  /poikkeamishakemu/i,
  /poikkeamispäätö/i,
  /*
   * Kaavoitus on jo katettu 248 omalla lahteella (07_ZONING_SOURCES), joten
   * paatosjarjestelmasta poimittu kaava-asia olisi kaksoiskappale.
   * Mitattu: "Mantyluoto 65. kaupunginosan asemakaavan laajennus" (Pori)
   * lapaisi listan sanalla "laajennu".
   */
  /asemakaav/i,
  // Valmistuneen hankkeen tilinpaatos, ei tuleva tyo.
  /lopputilitys/i,
]

export type CaseMConfig = {
  /** Aliverkkotunnus cloudnc.fi-alustalla, esim. "tampere". */
  host: string
  /*
   * Sivuston numero hakuosoitteessa (n-parametri). Sama 23 kaikilla neljalla
   * mitatulla asennuksella, ja sama luku toistuu asiapolussa
   * /fi-FI/content/<id>/23 - se on siis alustan vakio eika kuntakohtainen.
   * Jatetaan silti konfiguraatioon, koska yksi poikkeus riittaisi rikkomaan
   * oletuksen hiljaisesti (nolla osumaa nayttaa samalta kuin tyhja kunta).
   */
  siteId: number
  city: string
  region: string
  developer: string
  sourceName: string
}

/*
 * CaseM palauttaa HTML-entiteetit koodattuina (&auml; jne.), joten ne on
 * purettava ennen kuin teksti kelpaa kuvaukseksi tai täsmäytykseen.
 *
 * Purku delegoidaan jaetulle moduulille. Tässä oli oma entiteettilista,
 * joka kattoi vain tässä aineistossa sattumalta nähdyt merkit - juuri se
 * vika jonka vuoksi jaettu moduuli tehtiin. Puuttuva &sect; jätti
 * pykälämerkin purkamatta otsikkoriville.
 */
export function decodeEntities(text: string): string {
  return decodeHtmlEntities(text)
}

async function getHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/html,*/*",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/*
 * Suodatus tehtiin ensin pelkalla poissululla, koska hakusanan luultiin
 * rajaavan tuloksen jo riittavasti. Se ei riita: CaseM:n haku on
 * KOKOTEKSTIHAKU, joten sana osuu asiakirjan runkoon eika otsikkoon.
 * Mitattu kolmella uudella kunnalla - "peruskorjaus" palautti otsikot
 * "Ajankohtaiset asiat", "Ilmoitusasiat / Tekninen lautakunta" ja
 * "Viranhaltijapaatosten otto-oikeus", jotka kaikki lapaisivat poissulun.
 *
 * Siirrytaan siis samaan positiiviseen listaan kuin Dynastyssa ja STT:ssa
 * (D-029). Lista jaetaan Dynastyn kanssa eika kopioida: se on jo mitattu
 * kuuden kunnan aineistolla, ja kahden rinnakkaisen listan yllapito eriyttaisi
 * ne aikaa myoten.
 */
export function isConstructionSubject(subject: string): boolean {
  if (EXCLUDE_PATTERNS.some((re) => re.test(subject))) return false
  const text = subject.toLowerCase()
  return CONSTRUCTION_SIGNALS.some((k) => text.includes(k))
}

/*
 * Hakutulossivu listaa asiat linkkeinä. Otsikko on linkin sisällä, joten
 * molemmat poimitaan samalla kuviolla - erillinen otsikkohaku osuisi väärään
 * linkkiin kun sivulla on myös valikot.
 */
export function parseSearchResults(
  html: string
): { path: string; title: string }[] {
  const out: { path: string; title: string }[] = []

  for (const m of html.matchAll(
    /href="(\/fi-FI\/content\/\d+\/\d+)"[^>]*>([^<]{8,200})</g
  )) {
    const title = decodeEntities(m[2]).replace(/\s+/g, " ").trim()
    if (title) out.push({ path: m[1], title })
  }

  return out
}

/*
 * SISÄLTÖALUE RAJATAAN HTML:STÄ, EI TEKSTISTÄ.
 *
 * Asiasivulla on vasemmalla viranhaltijavalikko: linkkilista jokaiseen
 * kunnan viranhaltijanimikkeeseen. Rovaniemellä se on 93 riviä ja 2 700
 * merkkiä, ja se tulee HTML:ssä ennen varsinaista asiaa. Murupolusta
 * katkaisu ei sitä poista, koska valikko on murupolun jälkeen - kuvaus
 * alkoi siksi luettelolla "Alueellisten palvelujen päällikkö Apulaisrehtori
 * Korkalovaaran peruskoulu Elinkeinopäällikkö...".
 *
 * Vika ei ollut vain kosmeettinen: kohdetyyppi luetaan tekstin alusta, ja
 * valikossa on kymmenien koulujen rehtorit. Sipolantien purku-urakka sai
 * siksi kohdetyypin "Koulu".
 *
 * Alusta merkitsee alueet itse (`id="ContentStart"`, sivuvalikko
 * `id="Content_sidenaviArea"`), joten rajaus tehdään niillä eikä
 * suomenkielisillä avainsanoilla. Tarkistettu Jyväskylän, Porin ja
 * Rovaniemen asennuksilla: rakenne on sama, ja sivuvalikko on aina ennen
 * sisältöä.
 */
const MAIN_START = 'id="ContentStart"'
const MAIN_END = /class="[^"]*right-content|<footer/i

export function extractMainRegion(html: string): string | null {
  const marker = html.indexOf(MAIN_START)
  if (marker < 0) return null

  /*
   * Leikkaus alkaa avaustagin SULKEVASTA merkistä, ei tunnisteesta. Muuten
   * tagin loppuosa jää mukaan tekstiksi, koska tagien poisto ei tunnista
   * puolikasta tagia: kuvaus alkoi 'id="ContentStart" role="main">'.
   */
  const open = html.indexOf(">", marker)
  if (open < 0) return null

  const rest = html.slice(open + 1)
  const end = rest.search(MAIN_END)
  return end > 0 ? rest.slice(0, end) : rest
}

function flatten(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * Asiasivu on kokonainen HTML-sivu. Leipätekstiksi otetaan sisältöalue;
 * jos alusta ei sitä merkitse, palataan murupolkukatkaisuun.
 */
export function extractItemText(html: string): {
  text: string | null
  meetingDate: Date | null
} {
  const text = flatten(html)

  /*
   * Murupolku on muotoa "Toimielin > Kokous 7.9.2022 > Asian otsikko" ja se
   * antaa kaksi asiaa: kokouspäivän ja kohdan josta leipäteksti alkaa.
   * Ensimmäinen versio katkaisi tekstin merkkijonosta "Toimielimet >", jota
   * asiasivulla ei ole - kuvaus alkoi siksi murupolulla.
   *
   * Päivä luetaan KOKO sivulta, koska murupolku on sisältöalueen
   * ulkopuolella. Sisältöalueesta luettuna tuoreusraja lakkaisi toimimasta
   * hiljaisesti.
   */
  const dateMatch = text.match(/Kokous\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  const meetingDate = dateMatch
    ? new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]))
    : null

  const main = extractMainRegion(html)
  const crumbs = text.split(" > ")
  const body = (
    main ? flatten(main) : crumbs.length > 1 ? crumbs.slice(-1)[0] : text
  ).trim()

  /*
   * Otsikkorivin pykälänumero pois: "§ 4 Sipolantien 9 purku-urakka" ->
   * kuvaus alkaa asiasta. Numero on jo asiakirjaviitteessä.
   */
  const cleaned = body.replace(/^§\s*\d+\s*/, "")

  return { text: cleaned.length >= 80 ? cleaned : null, meetingDate }
}

export function createCaseMFetcher(config: CaseMConfig) {
  return async function fetchCaseM() {
    const base = `https://${config.host}.cloudnc.fi`
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)

    const results: any[] = []
    const seen = new Set<string>()
    let detailFetches = 0

    for (const term of SEARCH_TERMS) {
      for (let page = 1; page <= MAX_PAGES_PER_TERM; page++) {
        const url = `${base}/fi-FI/haku?n=${config.siteId}&d=1&s=${encodeURIComponent(
          term
        )}&o=Rank&page=${page}`
        const html = await getHtml(url)
        if (!html) break

        const hits = parseSearchResults(html)
        if (hits.length === 0) break

        for (const hit of hits) {
          if (seen.has(hit.path)) continue
          seen.add(hit.path)

          /*
           * Sama asia kasitellaan useassa toimielimessa - mitattu "Nekalan
           * koulun sisailmakorjaus" kolmesti eri kokouksista. Polku on eri
           * joka kerta, joten deduplikointi tehdaan otsikosta kuten
           * Dynastyssa.
           */
          const key = hit.title.toLowerCase().replace(/[^a-zåäö0-9]+/g, " ").trim()
          if (seen.has(key)) continue
          seen.add(key)

          if (!isConstructionSubject(hit.title)) continue
          if (detailFetches >= MAX_DETAIL_FETCHES_PER_RUN) continue

          detailFetches++
          const itemHtml = await getHtml(`${base}${hit.path}`)
          const parsed = itemHtml
            ? extractItemText(itemHtml)
            : { text: null, meetingDate: null }
          const description = parsed.text

          // Tuoreusraja luetaan murupolun kokouspaivasta.
          if (parsed.meetingDate && parsed.meetingDate < cutoff) continue

          /*
           * Ilman kuvausta ehdokas hylätään katselmoinnissa (D-027), joten
           * sellaista ei luoda - asia palaa seuraavassa ajossa kun
           * hakubudjetti riittää.
           */
          if (!description) continue

          const winners = extractDecisionWinners(description)

          results.push({
            name: hit.title,
            description,
            city: config.city,
            region: config.region,
            location:
              extractStreetAddress(hit.title) ?? extractStreetAddress(description),
            developer: config.developer,
            permit_number: hit.path.match(/content\/(\d+)/)?.[1] ?? null,
            property_type: inferBuildingType(hit.title, description),
            winners,
            phase: inferDecisionPhase({
              description,
              hasWinner: winners.length > 0,
              fallback: phaseFromTitle(hit.title),
            }),
            business_value: "high",
            source_url: `${base}${hit.path}`,
            confidence: 0.6,
            completed: false,
            source_name: config.sourceName,
          })
        }

        if (hits.length < RESULTS_PER_PAGE) break
      }
    }

    return results
  }
}

export const fetchTamperePaatoksetSource = createCaseMFetcher({
  host: "tampere",
  siteId: 23,
  city: "Tampere",
  region: "Pirkanmaa",
  developer: "Tampereen kaupunki",
  sourceName: "tampere_paatokset",
})

/*
 * Jyvaskyla, Rovaniemi ja Pori loytyivat samalta alustalta. Jyvaskyla oli
 * kirjattu Tweb-kunnaksi ja viidenneksi alustaperheeksi, mutta se osoittautui
 * vaaraksi: kaupungilla on kylla Tweb-asennus (julkinen.jkl.fi), mutta
 * paatokset ovat myos CaseM:ssa. Tweb-reitti olisi ollut turhaa tyota ja
 * lisaksi robots.txt kieltaa sen kokonaan.
 */
export const fetchJyvaskylaPaatoksetSource = createCaseMFetcher({
  host: "jyvaskyla",
  siteId: 23,
  city: "Jyväskylä",
  region: "Keski-Suomi",
  developer: "Jyväskylän kaupunki",
  sourceName: "jyvaskyla_paatokset",
})

export const fetchRovaniemiPaatoksetSource = createCaseMFetcher({
  host: "rovaniemi",
  siteId: 23,
  city: "Rovaniemi",
  region: "Lappi",
  developer: "Rovaniemen kaupunki",
  sourceName: "rovaniemi_paatokset",
})

export const fetchPoriPaatoksetSource = createCaseMFetcher({
  host: "pori",
  siteId: 23,
  city: "Pori",
  region: "Satakunta",
  developer: "Porin kaupunki",
  sourceName: "pori_paatokset",
})
