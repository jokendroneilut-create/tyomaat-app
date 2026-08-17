import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { extractStreetAddress } from "./extractStreetAddress"
import { NAME, cleanCompanyName, allativeToNominative } from "./companyName"

/*
 * STT Info -hakulähde. Toisin kuin nimetyt yrityslähteet (jotka lukevat yhden
 * yrityksen pressroomia), tämä hakee KAIKKIEN tiedottajien tiedotteita
 * hakusanoilla: sttinfo.fi/public-website-api/releases?search=<sana>. Näin
 * napataan isot yksityiset hankeilmoitukset (datakeskukset, tehtaat,
 * logistiikkakeskukset ym.) miltä tahansa rakennuttajalta, ei vain 7 nimetyltä.
 *
 * Hakusanat ovat korkean liikearvon HANKETYYPPEJÄ (ei geneerisiä sanoja kuten
 * "rakentaa", jotta osumat pysyvät relevantteina). Rajataan tuoreisiin (12 kk)
 * ja deduplikoidaan tiedote-id:llä. Kaupunki tekstistä (detectCityFromText),
 * rakennuttaja tiedottajasta. Confidence matala (0.5) — ihminen tarkistaa
 * TIC:issä. Sama palautusmuoto kuin muut yrityslähteet (sources.ts).
 */

/*
 * Tiedotteen julkaisija EI ole rakennuttaja silloin kun julkaisija on lupa- tai
 * valvontaviranomainen: se tiedottaa MUIDEN hankkeista. Esimerkiksi
 * "Lupa- ja valvontavirasto" julkaisee YVA-kuulutuksia, jolloin rakennuttajaksi
 * päätyi systemaattisesti virasto eikä hankkeen toteuttaja - mitattuna
 * 9 ehdokasta.
 *
 * Lista on tarkoituksella kapea: viranomainen voi myös olla aito rakennuttaja
 * (Väylävirasto, Senaatti-kiinteistöt, Puolustuskiinteistöt), joten tänne
 * kuuluvat vain ne jotka käsittelevät lupia ja kuulutuksia.
 */
const AUTHORITY_PUBLISHERS = [
  /lupa-\s*ja\s*valvontavirasto/i,
  /aluehallintovirasto/i,
  /\bavi\b/i,
  /ely-keskus/i,
  /elinkeino-,?\s*liikenne-\s*ja\s*ympäristökeskus/i,
  /ympäristöministeriö/i,
]

/*
 * Yritysnimi otsikosta tai kuvauksesta, kun julkaisija on viranomainen.
 * Kuulutuksissa hankkeen toteuttaja mainitaan lähes aina heti alussa:
 * "Bull Team Oy:n ja WeKas Oy:n laajennuksen YVA-menettely käynnistyy" tai
 * "Bull Team Oy ja WeKas Oy on toimittanut ... virastolle".
 *
 * Poimitaan vain yhtiömuodon sisältävät nimet, jottei tartu satunnaisiin
 * isoihin alkukirjaimiin. Useampi nimi yhdistetään, koska hankkeella voi olla
 * monta toteuttajaa.
 */
const COMPANY_NAME =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))\b/g

function extractCompaniesFromText(...texts: (string | null | undefined)[]): string | null {
  const joined = texts.filter(Boolean).join(" ")
  if (!joined) return null

  const found = new Map<string, string>()

  for (const match of joined.matchAll(COMPANY_NAME)) {
    const name = match[1].replace(/:n$/i, "").trim()
    if (name.length >= 4) found.set(name.toLowerCase(), name)
  }

  const names = Array.from(found.values()).slice(0, 3)
  return names.length > 0 ? names.join(", ") : null
}

/*
 * Tilaaja tiedotteen tekstistä.
 *
 * Urakoitsija tiedottaa omasta urakastaan, jolloin julkaisija on
 * PÄÄURAKOITSIJA eikä rakennuttaja. Tilaaja mainitaan tällöin lähes aina
 * tekstissä, ja juuri se erottaa urakan omasta perustajaurakoinnista:
 * "Skanska rakentaa Garminille toimitilat" on urakka, "Bonava rakentaa
 * Espooseen" on oma tuotanto jossa julkaisija todella on rakennuttaja.
 *
 * Tunnistus perustuu siis TILAAJAMAININTAAN eikä julkaisijan nimeen. Nimen
 * perusteella arvaaminen menisi väärin, koska perustajaurakoitsija
 * (Bonava, Pohjola Rakennus, YIT) on omissa kohteissaan oikeasti myös
 * rakennuttaja.
 */
/*
 * Nimen muoto ja siivous ovat lib/agent/companyName.ts:ssä, koska YVA-lähde
 * tarvitsee saman. Vain kuviot (kuka on tilaaja) ovat lähdekohtaisia.
 */

const CLIENT_PATTERNS = [
  // "tilaajana toimii Oulun Tilapalvelut Oy"
  new RegExp(`\\btilaajana\\s+(?:toimii\\s+)?(${NAME})`),
  // "rakennuttajana on Senaatti-kiinteistöt"
  new RegExp(`\\brakennuttajana\\s+(?:toimii\\s+|on\\s+)?(${NAME})`),
  // "HMT-Areena Oy:n merkittävä hanke"
  new RegExp(
    `\\b(${NAME}\\s+(?:Oy|Oyj|Ab|Ky|Ltd)):n\\s+(?:[A-Za-zåäöÅÄÖ]+\\s+)?(?:hanke|hanketta|toimeksianto|tilaus)`
  ),
  // "NCC:n toimeksiannosta"
  new RegExp(`\\b(${NAME})\\s*:n\\s+toimeksiannosta`),
  /*
   * "Peab toteuttaa Senaatti-kiinteistöille..." - urakoitsijan tiedotteessa
   * tilaaja on lähes aina allatiivissa, eikä yksikään yllä olevista kuvioista
   * tunnistanut sitä. Mitattu tapaus jäi ilman rakennuttajaa kokonaan.
   *
   * Nimi palautetaan perusmuodossa allativeToNominative-funktiolla, joka
   * palauttaa nullin jos muotoa ei voi päätellä yksikäsitteisesti - silloin
   * tämä kuvio ohitetaan eikä kirjoiteta väärää nimeä.
   */
  new RegExp(
    `\\b(?:toteuttaa|toteutti|rakentaa|rakensi|rakentanut|peruskorjaa|saneeraa|urakoi)\\s+(${NAME}lle)\\b`
  ),
  /*
   * "Peab ja Evijärven kunta ovat sopineet..." - urakoitsija ja tilaaja
   * rinnasteisina. Organisaatiosana on pienellä eikä kuulu NAME-kuvioon,
   * joten se sallitaan erikseen; ilman sitä tilaajaksi jäisi pelkkä
   * paikannimen genetiivi "Evijärven".
   */
  new RegExp(
    `\\bja\\s+(${NAME}(?:\\s+(?:kunta|kaupunki|seurakunta|kuntayhtymä|konserni))?)\\s+(?:ovat|on)\\s+sopi`
  ),
]

/*
 * Vain YKSISELITTEISET tilaajailmaukset — "tilaajana toimii X",
 * "rakennuttajana on X".
 *
 * MIKSI OMA FUNKTIO. `extractClientFromText` sisältää myös päätteleviä
 * kuvioita ("toteuttaa X:lle", "ja X ovat sopineet"), jotka voivat osua
 * mihin tahansa yritysnimeen tekstissä. Siksi osapuolet luetaan vain
 * ingressistä (LEAD_LENGTH = 700). Se rajaus kuitenkin hukkasi tilaajan
 * silloin kun se mainitaan vasta myöhemmin: mitattu 18.8.2026, Varten
 * hoivakotitiedotteessa "Hankkeen tilaajana toimii Asuntorakennuttajat
 * Group Oy" on merkillä 832, eli 132 merkkiä ingressin ulkopuolella.
 *
 * Nämä kaksi kuviota nimeävät tilaajan suoraan, joten ne ovat turvallisia
 * koko tekstissä — toisin kuin päättelevät kuviot.
 */
const EXPLICIT_CLIENT_PATTERNS = CLIENT_PATTERNS.slice(0, 2)

export function extractExplicitClient(text: string | null): string | null {
  const joined = String(text ?? "")
  if (!joined) return null

  for (const pattern of EXPLICIT_CLIENT_PATTERNS) {
    const match = joined.match(pattern)
    if (!match?.[1]) continue

    const name = cleanCompanyName(match[1])
    if (name.length >= 4) return name
  }

  return null
}

export function extractClientFromText(
  title: string | null,
  description: string | null
): string | null {
  const joined = [title, description].filter(Boolean).join(" ")
  if (!joined) return null

  for (const pattern of CLIENT_PATTERNS) {
    const match = joined.match(pattern)
    if (!match?.[1]) continue

    const raw = match[1]

    /*
     * Allatiivikuvio palauttaa taivutetun muodon, joka on käännettävä
     * perusmuotoon. Jos käännöstä ei voi tehdä yksikäsitteisesti, kuvio
     * ohitetaan - väärä nimi olisi huonompi kuin tyhjä kenttä.
     */
    const base = raw.endsWith("lle") ? allativeToNominative(raw) : raw
    if (!base) continue

    const name = cleanCompanyName(base)
    if (name.length >= 4) return name
  }

  return null
}

export type SttParties = {
  developer: string | null
  builder: string | null
}

export function resolveParties(
  publisher: string | null,
  title: string | null,
  description: string | null
): SttParties {
  if (!publisher) {
    return { developer: extractCompaniesFromText(title, description), builder: null }
  }

  const isAuthority = AUTHORITY_PUBLISHERS.some((pattern) => pattern.test(publisher))

  /*
   * Viranomaisjulkaisija hylätään aina: se tiedottaa MUIDEN hankkeista. Jos
   * toteuttajaa ei saada tekstistä, kenttä jää tyhjäksi - se on parempi kuin
   * väärä rakennuttaja, jonka ihminen joutuu huomaamaan ja korjaamaan.
   */
  if (isAuthority) {
    return { developer: extractCompaniesFromText(title, description), builder: null }
  }

  /*
   * Tilaaja mainittu -> julkaisija on urakoitsija. Mitattu tapaus:
   * "Rakennusliike Soimu rakentaa Siilinjärvelle uuden palloiluhallin",
   * tilaajana HMT-Areena Oy. Kannassa luki rakennuttajana Soimu, joka on
   * pääurakoitsija.
   */
  const client = extractClientFromText(title, description)
  if (client && client.toLowerCase() !== publisher.toLowerCase()) {
    return { developer: client, builder: publisher }
  }

  return { developer: publisher, builder: null }
}

/** Säilytetään vanha rajapinta; palauttaa vain rakennuttajan. */
export function resolveDeveloper(
  publisher: string | null,
  title: string | null,
  description: string | null
): string | null {
  return resolveParties(publisher, title, description).developer
}

/*
 * Tiedotteen koko teksti.
 *
 * Hakurajapinta palauttaa vain otsikon, URL:n ja metadescriptionin
 * (150-250 merkkiä). Kaikki hankkeen kannalta arvokas on leipätekstissä:
 * mitattuna Siilinjärven palloiluhallin tiedotteessa 3 200 merkkiä, joissa
 * osoite, bruttoala, kustannusarvio, aikataulu, urakkamuoto ja tilaaja -
 * kannassa niistä ei ollut yhtäkään.
 *
 * Sivu haetaan siksi erikseen. Haku on kallis (yksi pyyntö per tiedote),
 * joten kutsuja rajaa määrän ja hakee vain vielä näkemättömille.
 */
export async function fetchSttReleaseBody(url: string): Promise<string | null> {
  try {
    const response = await sttFetch(url, "text/html")
    if (!response || !response.ok) return null

    const html = await response.text()

    /*
     * Leipäteksti on JSON-LD:n articleBody-kentässä. Se on luotettavampi kuin
     * DOM-rakenne, joka vaihtelee julkaisijan mallin mukaan.
     */
    const jsonLd = html.match(
      /"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/
    )?.[1]

    if (jsonLd) {
      const decoded = jsonLd
        .replace(/\\n/g, " ")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        )
        .replace(/\s+/g, " ")
        .trim()

      if (decoded.length > 100) return decoded
    }

    // Varalla: tiedotteen runko-osa ilman skriptejä ja navigaatiota.
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .match(/<article[\s\S]*?<\/article>/i)?.[0]

    if (!body) return null

    const text = body
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      /*
       * Sivun otsikkopalkki pois: "23.6.2026 14:51:21 EEST | Julkaisija |
       * Tiedote Jaa". Se ei kerro hankkeesta mitään ja veisi kortilla tilan
       * varsinaiselta tekstiltä.
       */
      .replace(
        /^.*?\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}[^|]*\|[^|]*\|\s*Tiedote\s*(?:Jaa)?\s*/i,
        ""
      )
      .trim()

    return text.length > 100 ? text : null
  } catch {
    return null
  }
}

/*
 * Täydentää kandidaatin tiedotteen tekstillä: kuvaus, tilaaja/urakoitsija ja
 * työmaan osoite. Palauttaa kandidaatin sellaisenaan jos haku ei onnistu -
 * puuttuva lisätieto on parempi kuin kaatunut ajo.
 */
export async function enrichSttCandidate(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  const body = await fetchSttReleaseBody(candidate.source_url)
  if (!body) return candidate

  const publisher = candidate.builder ?? candidate.developer ?? null
  const parties = resolveParties(publisher, candidate.name, body)

  return {
    ...candidate,
    description: body.slice(0, 4000),
    developer: parties.developer ?? candidate.developer ?? null,
    builder: parties.builder ?? candidate.builder ?? null,
    location: candidate.location ?? extractStreetAddress(body),
  }
}

const SEARCH_TERMS = [
  // Yleiset rakennushanke-termit
  "rakennushanke",
  "rakennustyöt",
  "rakennusurakka",
  "uudisrakennus",
  "uudiskohde",
  "peruskorjaus",
  "saneeraus",
  // Asuminen
  "asuinkerrostalo",
  "asuntohanke",
  "asuinkortteli",
  "vuokra-asuntoja",
  // Toimitilat ja kauppa
  "toimitilahanke",
  "toimitilarakennus",
  "liikekeskus",
  "kauppakeskus",
  "hotelli rakenne",
  // Teollisuus ja logistiikka
  "datakeskus",
  "konesali",
  "logistiikkakeskus",
  "jakelukeskus",
  "tuotantolaitos",
  "teollisuushalli",
  "akkutehdas",
  // Julkiset ja hoiva
  "hoivakoti",
  "palvelutalo",
  "päiväkoti",
  "koulurakennus",
  "sairaala rakenne",
  // Infra ja energia
  "sähköasema",
  "voimalaitos",
  "aurinkovoimala",
  "biokaasulaitos",
  /*
   * Tuulivoima puuttui kokonaan, vaikka se on YVA-aineiston suurin
   * hankeluokka (120/312 hanketta). Molemmat kirjoitusasut ovat käytössä.
   */
  "tuulivoimahanke",
  "tuulivoimapuisto",
  /*
   * Kunnan investointipäätösketju. RPT-listan läpikäynti paljasti että
   * juuri tämä vaihe puuttuu meiltä: hanke on nimetty ja päätetty mutta
   * ei vielä kilpailutettu, joten se ei näy Hilmassa eikä urakoitsijan
   * tiedotteissa. Mitatut kärkiosumat ovat kaupunginvaltuuston ja
   * lautakuntien päätöksiä.
   *
   * "perusparannus" on kuntien vakiotermi peruskorjaukselle - sen
   * puuttuminen oli mitattu aukko (Töölön kisahalli, Helsingin RPT-
   * listan sija 13).
   */
  "hankesuunnitelma",
  "tarveselvitys",
  "perusparannus",
  "investointipäätös",
  // Kohdetyypit joiden kärkiosumat mitattiin puhtaiksi
  "monitoimitalo",
  "pysäköintilaitos",
  "purku-urakka",
  "siltaurakka",
  "ratahanke",
]

// Kevyt poissulku: tiedote joka on selvästi talous-/hallintouutinen, ei hanke.
/*
 * Positiivinen vaatimus: tekstissä on oltava rakentamiseen viittaava sana.
 *
 * STT:n haku on löyhä kokotekstihaku eikä fraasihaku - mitattu: hakusana
 * "koulurakennus" antaa 181 osumaa joiden otsikoissa lukee vain "koulu", ja
 * "päiväkoti" antaa 2269 osumaa joissa on mm. koiraturvallisuutta. Kun haku
 * sivutettiin oikein, tulos kasvoi 82 -> 1855 mutta otoksesta mitattuna
 * 65 % oli kohinaa: nimitysuutisia, tutkimuksia, tapahtumia.
 *
 * Pelkkä EXCLUDE-lista ei riitä tällaista kirjoa vastaan - poissuljettavia
 * aiheita on ääretön määrä, rakentamisen sanastoa ei. Siksi vaaditaan
 * positiivinen osuma.
 */
const CONSTRUCTION_SIGNALS = [
  "rakenn", // rakennus, rakentaa, rakennetaan, rakennuttaja, rakenteilla
  "urakka",
  "urakoi",
  "urakan",
  "peruskorja",
  /*
   * "perusparannus" on kuntien vakiotermi peruskorjaukselle - Helsinki
   * käyttää sitä johdonmukaisesti. Puuttuminen pudotti mitatusti Töölön
   * kisahallin, joka on Helsingin RPT-listalla sijalla 13.
   */
  "perusparann",
  "tarveselvit",
  "hankesuunnitel",
  "korjaushank",
  "kunnostu",
  "saneera",
  "laajenn",
  "uudisko",
  "uudisra",
  "investoi",
  "purkutyö",
  "valmistuu",
  "valmistui",
  "harjannostajais",
  "kaavamuutos",
  "asemakaav",
  "tontin",
  "tontille",
  "kiinteistökehit",
  "toimitila",
  "työmaa",
]

const EXCLUDE_KEYWORDS = [
  "osavuosikatsaus",
  "tilinpäätös",
  "vuosikertomus",
  "nimity",
  "toimitusjohtaja",
  "hallituksen jäsen",
  "tulosvaroitus",
  "tulosohjeistus",
  "liikevaihto",
  "vastuullisuusraport",
  "yhtiökokous",
  "osake",
]

const COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "otettu käyttöön",
  "vihittiin käyttöön",
  "avattiin",
]

/*
 * Yhden hakusanan tiedotteet, sivutettuna tuoreusrajaan asti.
 *
 * Aiemmin haettiin `count=20` ilman sivutusta. STT ei tunne `count`-
 * parametria lainkaan, joten se ohitettiin hiljaa ja vastauksena tuli
 * oletusmäärä 10. Mitattu: hakusana "peruskorjaus" ilmoittaa
 * `totalCount: 1397` ja palautti meille 10 - eli noin 0,7 %. Noin 34
 * hakusanalla katoimme korkeintaan ~340 tiedotetta.
 *
 * Oikeat parametrit ovat `size` (testattu toimivaksi 500:aan asti) ja
 * `page` (0-alkuinen). Neljä 50 kappaleen sivua tuotti 200 eri tiedotetta
 * ilman yhtään päällekkäisyyttä, eli sivutus on johdonmukainen.
 *
 * Sama vikaluokka kuin YVA-haussa (D-026): pyyntö onnistuu, vastaus näyttää
 * täydeltä, ja katkaisu on näkymätön. Siksi tässä pysähdytään
 * tuoreusrajaan eikä kiinteään määrään.
 */
const STT_PAGE_SIZE = 100
const STT_MAX_PAGES = 10

/*
 * HAKU RINNAKKAIN, KOSKA SE ON AJON PULLONKAULA.
 *
 * Mitattu 13.8.2026: 44 hakusanaa tuottivat 58 pyyntoa ja
 * **59,6 sekuntia** perakkain ajettuna, keskimaarin 1 027 ms per pyynto.
 * Se on yksin enemman kuin lahdeajon koko 90 sekunnin budjetti kestaa,
 * kun paalle tulee viela taydennys ja tuonti - ja juuri siksi STT-ajo
 * ylitti reitin aikarajan ja jai tilaan "started" kahdeksi paivaksi.
 *
 * Hakusanat ovat toisistaan riippumattomia, joten ne voi hakea
 * rinnakkain. Kuusi kerrallaan pudottaa hakuvaiheen noin kymmeneen
 * sekuntiin olematta rajapinnalle epakohtelias.
 */
const STT_TERM_CONCURRENCY = 6

/*
 * YKSI HIDAS PYYNTO EI SAA SYODA BUDJETTIA. Mitattu: hakusana
 * "rakennusurakka" vastasi kerran 15,5 sekunnissa, kun mediaani on noin
 * sekunti. Ilman katkaisua yksi tallainen riittaa kaatamaan koko ajon
 * aikarajaan.
 */
const STT_REQUEST_TIMEOUT_MS = 15 * 1000

async function sttFetch(url: string, accept: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STT_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        accept,
      },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchTermReleases(
  term: string,
  cutoffDate: Date
): Promise<any[]> {
  const collected: any[] = []

  for (let page = 0; page < STT_MAX_PAGES; page++) {
    let data: any = null
    try {
      const res = await sttFetch(
        `https://www.sttinfo.fi/public-website-api/releases?search=${encodeURIComponent(
          term
        )}&language=fi&size=${STT_PAGE_SIZE}&page=${page}`,
        "application/json"
      )
      if (!res || !res.ok) break
      data = await res.json()
    } catch {
      break
    }

    const releases = data?.releases ?? []
    if (releases.length === 0) break

    collected.push(...releases)

    /*
     * Tulokset ovat uusimmasta vanhimpaan, joten sivun viimeinen on sen
     * vanhin. Kun se ylittää tuoreusrajan, loput sivut ovat vielä
     * vanhempia eikä niitä tarvitse hakea.
     */
    const oldest = releases[releases.length - 1]?.date
    if (oldest && new Date(oldest) < cutoffDate) break
    if (releases.length < STT_PAGE_SIZE) break
  }

  return collected
}

export async function fetchSttHakuSource() {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 12)

  const results: any[] = []
  const seen = new Set<string>()

  /*
   * Hakusanat rinnakkain, tulokset jarjestyksessa: seen-joukko ja
   * results-taulukko taytetaan vasta kun kaikki on haettu, jotta
   * lopputulos ei riipu siita missa jarjestyksessa pyynnot palasivat.
   */
  const byTerm: any[][] = new Array(SEARCH_TERMS.length)
  let termCursor = 0

  await Promise.all(
    Array.from({ length: STT_TERM_CONCURRENCY }, async () => {
      while (termCursor < SEARCH_TERMS.length) {
        const index = termCursor++
        byTerm[index] = await fetchTermReleases(SEARCH_TERMS[index], cutoffDate)
      }
    })
  )

  for (const releases of byTerm) {
    for (const release of releases ?? []) {
      const id = String(release?.id ?? "")
      if (!id || seen.has(id)) continue

      const releaseDate = release?.date ? new Date(release.date) : null
      if (releaseDate && releaseDate < cutoffDate) continue

      const fi = release?.versions?.fi
      const title = (fi?.title || "").trim()
      const relativeUrl = fi?.url || ""
      if (!title || !relativeUrl) continue

      const description =
        (fi?.metadescription || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim() || null

      const haystack = `${title} ${description ?? ""}`.toLowerCase()
      if (EXCLUDE_KEYWORDS.some((k) => haystack.includes(k))) continue
      if (!CONSTRUCTION_SIGNALS.some((k) => haystack.includes(k))) continue

      seen.add(id)

      const absoluteHref = relativeUrl.startsWith("http")
        ? relativeUrl
        : `https://www.sttinfo.fi${relativeUrl}`

      const city = detectCityFromText(haystack)
      const region = city ? getMunicipalityByName(city)?.region ?? null : null
      const completed = COMPLETED_KEYWORDS.some((k) => haystack.includes(k))

      const parties = resolveParties(
        release?.publisher?.name ?? null,
        title,
        description
      )

      results.push({
        name: title,
        description,
        city,
        region,
        location: null,
        developer: parties.developer,
        builder: parties.builder,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: absoluteHref,
        confidence: 0.5,
        completed,
        source_name: "stt_haku",
      })
    }
  }

  return results
}
