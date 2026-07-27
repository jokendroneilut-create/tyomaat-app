import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

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
  size: 150,
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

  let hits: any[] = []
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
      body: JSON.stringify(ES_QUERY),
    })
    if (!res.ok) return []
    const json = await res.json()
    hits = Array.isArray(json?.hits?.hits) ? json.hits.hits : []
  } catch {
    return []
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
    const description = (s.description || "").replace(/\s+/g, " ").trim()
    const subjectLabel = Array.isArray(s.subjectArea) ? s.subjectArea.join(", ") : ""

    results.push({
      name: title,
      description:
        description ||
        `YVA-hanke${subjectLabel ? ` (${subjectLabel})` : ""}. Ympäristövaikutusten arviointi käynnissä.`,
      city,
      region,
      location: null,
      developer: null,
      permit_number: null,
      property_type: null,
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
