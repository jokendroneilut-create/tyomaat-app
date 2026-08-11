import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { NAME, cleanCompanyName, looksLikeCompany } from "./companyName"

/*
 * YVA-lähde (ympäristövaikutusten arviointi, ymparisto.fi).
 *
 * YVA on pakollinen isoille hankkeille (tuuli-/aurinko-/ydinvoima, kaivokset,
 * tehtaat, datakeskukset, akkumateriaali, biojalostamot, voimajohdot, suuret
 * väylät) ja se käynnistyy hankkeen KAIKKEIN aikaisimmassa vaiheessa — usein
 * vuosia ennen rakennuslupaa tai kilpailutusta. Tämä on siis se lähde jolla
 * saamme suurimmat hankkeet kiinni ensimmäisenä, ennen kilpailijoita.
 *
 * Tekninen toteutus: ymparisto.fi:n haku on Elasticsearch-proxy osoitteessa
 * POST /fi/app/search/query, joka välittää raa'an ES-DSL-kyselyn. Suodatamme
 * type=yva_project, järjestämme julkaisuajan mukaan uusimmasta ja rajaamme
 * tuoreisiin. Ei vaadi evästettä/tokenia. Vastaus: hits.hits[]._source kentillä
 * title, description, content, link, publishTime (unix s), municipality[],
 * province[], organization[] (= ELY/viranomainen, EI rakennuttaja),
 * projectPhase[], subjectArea[].
 *
 * Suodatus: (1) vain Suomen kunnat — pudottaa rajat ylittävät YVA:t (Viro,
 * Ruotsi, Tanska…). (2) Tuoreus publishTime:sta. (3) Pois selkeästi
 * ei-rakennushankkeet: turvetuotanto (maa-aineksen otto, hiipuva) ja
 * suunnitelmien/ohjelmien ympäristöarvioinnit (SOVA, ei rakennettava hanke).
 * Confidence 0.5, ihminen tarkistaa TIC:issä.
 */

const SEARCH_URL = "https://www.ymparisto.fi/fi/app/search/query"
const PROJECT_URL = (link: string) =>
  link?.startsWith("http") ? link : `https://www.ymparisto.fi${link || ""}`

const RECENCY_MONTHS = 18

/*
 * subjectArea-arvot jotka EIVÄT ole rakennushankkeita: turvetuotanto (maa-
 * aineksen otto) ja suunnitelmien/ohjelmien arvioinnit (SOVA).
 */
const EXCLUDE_SUBJECT_AREAS = ["turvetuotanto", "suunnitelmat ja ohjelmat"]

/*
 * Otsikkovihjeet suunnitelmien/ohjelmien ympäristöarvioinnista (SOVA) — nämä
 * eivät ole yksittäisiä rakennettavia hankkeita.
 */
const EXCLUDE_TITLE_PATTERNS = [
  /suunnitelmien ympäristöarviointi/i,
  /merialuesuunnitel/i,
  /ohjelman ympäristöarviointi/i,
]

const ES_QUERY = {
  _source: [
    "id",
    "link",
    "type",
    "publishTime",
    "title",
    "description",
    "content",
    "municipality",
    "province",
    "organization",
    "projectPhase",
    "subjectArea",
    "projectType",
  ],
  query: { bool: { filter: [{ term: { type: "yva_project" } }] } },
  sort: [{ publishTime: { order: "desc" } }],
}

/*
 * Sivutus: aineistossa on yli 1300 YVA-hanketta, ja kiinteä size katkaisi
 * haun ennen tuoreusikkunan reunaa. Mitattu ennen korjausta: size 150 ulottui
 * vain kolmen kuukauden taakse (vanhin 2026-05-08), joten RECENCY_MONTHS = 18
 * oli kuollutta koodia ja 3-18 kuukauden ikäiset hankkeet jäivät kokonaan
 * hakematta - juuri se ikkuna jonka vuoksi lähde on olemassa. Yksittäinen
 * mitattu tapaus: "Halmemäen tuulivoimahanke, Kärsämäki" jäi rajan taakse.
 *
 * Haetaan sivu kerrallaan kunnes sivun vanhin osuma ylittää tuoreusrajan.
 * Yläraja on turvaventtiili: aineiston koko on lähteen päätettävissä, eikä
 * yksi ajo saa jumittua tuhansiin sivupyyntöihin.
 */
const PAGE_SIZE = 150
const MAX_PAGES = 12

/*
 * Hankkeesta vastaava YVA-tekstistä.
 *
 * `organization` on viranomainen (ELY / Lupa- ja valvontavirasto), EI
 * rakennuttaja — se on todettu jo tiedostokommentissa. Rakennuttaja lukee
 * leipätekstissä, ja mitatussa 25 hankkeen otoksessa kuvio "X suunnittelee"
 * esiintyi 22:ssa ja "hankkeesta vastaa" 8:ssa.
 *
 * Yhtiömuotoa vaaditaan, koska kuvio on löyhä: ilman sitä "Yhtiö suunnittelee"
 * tai "Hanke suunnittelee" poimisi nimeksi yleissanan. Otoksen jokaisessa
 * hankkeessa mainittiin Oy, Oyj, Ab tai Ky, joten rajaus ei maksa mitään.
 */
const DEVELOPER_PATTERNS = [
  // "Hankkeesta vastaavana toimiva Eolus Energy Oy suunnittelee..."
  new RegExp(`\\bhankkeesta\\s+vastaa(?:vana\\s+toimiva)?\\s+(${NAME})`, "i"),
  new RegExp(`\\bhankevastaava(?:na)?\\s+(?:toimii\\s+|on\\s+)?(${NAME})`, "i"),
  // "Infinergies Finland Oy suunnittelee enintään 68 tuulivoimalan..."
  new RegExp(`(${NAME})\\s+(?:suunnittelee|selvittää|hakee|toteuttaa)`),
]

/*
 * Sivun lyhytosoite on leipätekstin seassa ja päättyy usein isoihin
 * kirjaimiin, jolloin se liittyy heti perässä olevaan nimeen: mitattu
 * "...rikastushiekka-YVA Dragon Mining Oy suunnittelee" -> nimeksi tuli
 * "YVA Dragon Mining Oy". Osoitteet pudotetaan ennen poimintaa.
 */
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi

/*
 * Pelkkä maa + yhtiömuoto on aina katkennut nimi, ei yritys. Syntyy kun
 * nimi alkaa pienellä kirjaimella eikä siksi mahdu NAME-kuvioon: mitattu
 * "wpd Suomi Oy" -> "Suomi Oy". Mieluummin tyhjä kuin väärä rakennuttaja.
 */
const TRUNCATED_NAME = /^(?:Suomi|Finland|Sverige|Norge)\s+(?:Oy|Oyj|Ab|Ky)$/i

export function extractYvaDeveloper(text: string | null | undefined): string | null {
  if (!text) return null

  const cleaned = text.replace(URL_PATTERN, " ")

  for (const pattern of DEVELOPER_PATTERNS) {
    const match = cleaned.match(pattern)
    if (!match?.[1]) continue

    const name = cleanCompanyName(match[1])
    if (name.length < 4) continue
    if (!looksLikeCompany(name)) continue
    if (TRUNCATED_NAME.test(name)) continue

    return name
  }

  return null
}

/*
 * Hakuvastauksen `content` on koko sivun leipäteksti HTML-entiteetteineen ja
 * rivinvaihtoineen. Otsikko toistuu sen alussa, joten se pudotetaan.
 */
export function cleanYvaContent(
  raw: string | null | undefined,
  title: string
): string | null {
  if (!raw) return null

  const text = raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

  const withoutTitle = text.startsWith(title) ? text.slice(title.length).trim() : text

  return withoutTitle || null
}

/*
 * YVA-MENETTELYN TILA (`projectPhase`).
 *
 * Kenttä on haettu _source-listassa alusta asti mutta jäi käyttämättä:
 * jokainen YVA-rivi sai kovakoodatun vaiheen "Suunnittelussa". Mitattu
 * 12.8.2026, 900 hanketta: "Päättynyt / perusteltu päätelmä annettu" 644,
 * "Vireillä" 242, tyhjä 14. Kenttä on siis rakenteinen ja kattava - tätä
 * ei tarvitse jäsentää leipätekstistä.
 *
 * "PÄÄTTYNYT" EI TARKOITA ETTÄ HANKE OLISI OHI. Se tarkoittaa että
 * YVA-MENETTELY on päättynyt: yhteysviranomainen on antanut perustellun
 * päätelmänsä, joka on edellytys lupahakemuksille (ympäristölupa,
 * rakennuslupa). Hanke on siis läpäissyt portin ja etenee luvitukseen -
 * se on myönteinen signaali, ei kuolinilmoitus. Todiste samasta
 * aineistosta: Kirkkonummen datakeskuksen perusteltu päätelmä annettiin
 * 9.7.2024 ja hanke on nyt rakenteilla.
 *
 * SIKSI TILAA EI KÄÄNNETÄ VAIHEEKSI. Jos "Päättynyt" mäpättäisiin
 * vaiheeksi "Valmistunut", 644 elävää hanketta merkittäisiin valmiiksi -
 * ja auto-complete-cron sekä `ignore-stale-completed.ts` siivoaisivat ne
 * pois jonosta ja asiakasnäkymästä. Vaihe pysyy "Suunnittelussa",
 * koska kumpikaan tila ei kerro onko rakentaminen alkanut; tila
 * talletetaan omaan kenttäänsä jossa se on luettavissa sellaisenaan.
 */
const YVA_STATUS_CONCLUDED = "Päättynyt / perusteltu päätelmä annettu"

export function readYvaStatus(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const text = String(value ?? "").replace(/\s+/g, " ").trim()
  return text || null
}

export function yvaStatusIsConcluded(status: string | null): boolean {
  return status === YVA_STATUS_CONCLUDED
}

function firstFinnishMunicipality(raw: unknown): string | null {
  const names = Array.isArray(raw)
    ? raw.flatMap((v) => String(v).split(","))
    : String(raw ?? "").split(",")
  for (const n of names) {
    const name = n.trim()
    if (name && getMunicipalityByName(name)) return name
  }
  return null
}

export async function fetchYvaSource() {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - RECENCY_MONTHS)

  const hits: any[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        },
        body: JSON.stringify({
          ...ES_QUERY,
          from: page * PAGE_SIZE,
          size: PAGE_SIZE,
        }),
      })
      if (!res.ok) break

      const json = await res.json()
      const pageHits = Array.isArray(json?.hits?.hits) ? json.hits.hits : []
      if (pageHits.length === 0) break

      hits.push(...pageHits)

      /*
       * Tulokset ovat julkaisuajan mukaan uusimmasta, joten sivun viimeinen
       * on sen vanhin. Kun se ylittää tuoreusrajan, loput sivut ovat vielä
       * vanhempia eikä niitä tarvitse hakea.
       */
      const oldest = pageHits[pageHits.length - 1]?._source?.publishTime
      if (oldest && new Date(oldest * 1000) < cutoffDate) break
      if (pageHits.length < PAGE_SIZE) break
    }
  } catch {
    /*
     * Virhe kesken sivutuksen: pidetään jo haetut sivut. Osittainen tulos on
     * parempi kuin tyhjä, koska ehdokkaat täydentyvät joka tapauksessa
     * seuraavilla ajoilla.
     */
    if (hits.length === 0) return []
  }

  const results: any[] = []
  const seen = new Set<string>()

  for (const h of hits) {
    const s = h?._source ?? {}

    const title = (s.title || "").replace(/\s+/g, " ").trim()
    if (!title) continue

    const key = String(s.id ?? s.link ?? title)
    if (seen.has(key)) continue

    const publishedAt = s.publishTime ? new Date(s.publishTime * 1000) : null
    if (publishedAt && publishedAt < cutoffDate) continue

    // Vain Suomen kunnat — pudottaa rajat ylittävät YVA:t.
    const city =
      firstFinnishMunicipality(s.municipality) ??
      firstFinnishMunicipality(s.province) ??
      detectCityFromText(title)
    if (!city) continue

    const subjectAreas = (Array.isArray(s.subjectArea) ? s.subjectArea : [])
      .map((v: unknown) => String(v).toLowerCase())
    if (subjectAreas.some((sa: string) => EXCLUDE_SUBJECT_AREAS.some((ex) => sa.includes(ex)))) {
      continue
    }
    if (EXCLUDE_TITLE_PATTERNS.some((re) => re.test(title))) continue

    seen.add(key)

    const region = getMunicipalityByName(city)?.region ?? null
    const summary = (s.description || "").replace(/\s+/g, " ").trim()
    const subjectLabel = Array.isArray(s.subjectArea) ? s.subjectArea.join(", ") : ""

    /*
     * `content` on koko hankekuvaus ja tulee samassa hakuvastauksessa - sitä
     * pyydettiin jo _source-listassa mutta ei käytetty, joten ehdokas syntyi
     * pelkän tiivistelmän varassa. Mitattu tapaus "Halmemäen tuulivoimahanke":
     * tiivistelmä 78 merkkiä, content 8 639 merkkiä, ja jälkimmäisessä on
     * voimaloiden määrä, teho, korkeus, hankealueen pinta-ala ja sijainti
     * suhteessa keskustaajamaan. Otoksessa content oli 25/25 hankkeessa.
     */
    const body = cleanYvaContent(s.content, title)

    const yvaStatus = readYvaStatus(s.projectPhase)

    /*
     * Tila kirjoitetaan myös kuvaukseen, koska katselmoija ja asiakas
     * lukevat kuvausta - pelkkä metadata-kenttä ei näkyisi kummallekaan.
     */
    const baseDescription =
      body ||
      summary ||
      `YVA-hanke${subjectLabel ? ` (${subjectLabel})` : ""}. Ympäristövaikutusten arviointi käynnissä.`

    results.push({
      name: title,
      description: yvaStatus
        ? `YVA-menettelyn tila: ${yvaStatus}.\n\n${baseDescription}`
        : baseDescription,
      metadata: { yva_status: yvaStatus },
      city,
      region,
      location: null,
      developer: extractYvaDeveloper(body ?? summary),
      permit_number: null,
      /*
       * subjectArea on hanketyyppi ("Tuulivoimalahankkeet"). projectType on
       * mitatussa otoksessa 0/25 eli aina tyhjä, joten sitä ei käytetä.
       */
      property_type:
        (Array.isArray(s.subjectArea) ? s.subjectArea[0] : null) || null,
      /*
       * Vaihe pysyy suunnitteluna myös päättyneellä YVA:lla - ks. perustelu
       * `readYvaStatus`-kuvion yhteydessä. Kumpikaan tila ei kerro onko
       * rakentaminen alkanut, ja "Valmistunut" hävittäisi elävät hankkeet.
       */
      phase: "Suunnittelussa",
      business_value: "high",
      source_url: PROJECT_URL(s.link),
      confidence: 0.5,
      completed: false,
      source_name: "yva",
    })
  }

  return results
}
