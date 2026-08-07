import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { extractStreetAddress } from "./extractStreetAddress"

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
const NAME_PART = "[A-ZÅÄÖ][A-Za-z0-9åäöÅÄÖ&.\\-]*"
const NAME = `${NAME_PART}(?:\\s+${NAME_PART})*`

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
]

/*
 * Nimen perässä oleva välimerkki ei kuulu nimeen. Piste sallitaan sanan
 * sisällä ("As. Oy"), joten se siivotaan vasta lopusta.
 */
function cleanCompanyName(raw: string): string {
  /*
   * Nimi katkaistaan yhtiömuotoon. Ilman tätä kaappaus jatkuu seuraavaan
   * virkkeeseen, koska piste kuuluu nimimerkkeihin ("As. Oy") ja seuraava
   * sana on usein iso alkukirjain: mitattu "HMT-Areena Oy. Tilaajien".
   */
  const withForm = raw.match(/^(.*?\b(?:Oy|Oyj|Ab|Ky|Ltd))\b/)
  const name = withForm?.[1] ?? raw

  return name
    .replace(/:n$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim()
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

    const name = cleanCompanyName(match[1])
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
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        accept: "text/html",
      },
    })
    if (!response.ok) return null

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
]

// Kevyt poissulku: tiedote joka on selvästi talous-/hallintouutinen, ei hanke.
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

export async function fetchSttHakuSource() {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 12)

  const results: any[] = []
  const seen = new Set<string>()

  for (const term of SEARCH_TERMS) {
    let data: any = null
    try {
      const res = await fetch(
        `https://www.sttinfo.fi/public-website-api/releases?search=${encodeURIComponent(
          term
        )}&count=20&language=fi`,
        {
          cache: "no-store",
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
            accept: "application/json",
          },
        }
      )
      if (!res.ok) continue
      data = await res.json()
    } catch {
      continue
    }

    for (const release of data?.releases ?? []) {
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
