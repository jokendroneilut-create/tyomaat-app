import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

/*
 * Ympäristölupa- / YVA-lähde (Lupa- ja valvontaviraston ympäristöasioiden
 * tietopalvelu, ent. AVI). Isot yksityiset teollisuus-, energia- ja
 * datakeskushankkeet näkyvät TÄSSÄ vaiheessa aikaisin — usein ennen rakennus-
 * lupaa ja ilman julkista kilpailutusta — joten tämä paikkaa juuri sen aukon
 * jonka takia esim. Forssan datakeskus jäi aiemmin huomaamatta.
 *
 * API: POST /api/v1/cases/search { query } palauttaa asiat kentillä
 * name (hanke + kunta), applicant (rakennuttaja), municipality (kunta),
 * journalNumber (diaarinumero = vahva tunniste), published. Haetaan korkean
 * arvon hanketyypeillä, rajataan tuoreisiin, deduplikoidaan diaarinumerolla.
 *
 * Suodatus: isot hakusanat (tehdas, voimalaitos, terminaali, kaivos) tuottavat
 * enimmäkseen OLEMASSA olevien laitosten lupamuutoksia — ne suodatetaan pois
 * jotta jäljelle jää UUSIEN laitosten rakentaminen. Confidence 0.55, ihminen
 * tarkistaa TIC:issä.
 */

const SEARCH_URL = "https://ytietopalvelu.lvv.fi/api/v1/cases/search"
const CASE_URL = (id: number | string) => `https://ytietopalvelu.lvv.fi/fi-FI/asia/${id}`

const SEARCH_TERMS = [
  "datakeskus",
  "konesali",
  "tuotantolaitos",
  "tehdas",
  "akkutehdas",
  "akkumateriaali",
  "aurinkovoimala",
  "aurinkopuisto",
  "tuulipuisto",
  "biokaasulaitos",
  "vetylaitos",
  "logistiikkakeskus",
  "betoniasema",
  "asfalttiasema",
  "terminaali",
]

/*
 * Olemassa olevan laitoksen lupamuutos/valvonta EI ole rakennushanke — vain
 * uuden laitoksen ympäristölupa on. Pudotetaan muutos-/valvontatermit.
 */
const EXCLUDE_KEYWORDS = [
  "muuttamin",
  "muutos",
  "muutta",
  "lupamääräyk",
  "rauettamin",
  "tarkistamin",
  "valvonta",
  "koetoiminta",
  "seuranta",
  "olennainen",
  "lupaehto",
  "jatkoaik",
  "vakuus",
  "hakemuksen peruut",
  // Vesirakentaminen / kunnossapito / purku — ei rakennushankelead.
  "purkamin",
  "pato",
  "ojitus",
  "kalatie",
  "kunnostam",
  "koskevan pää",
  "uoman",
  "ruoppa",
]

const COMPLETED_KEYWORDS = ["valmistui", "valmistunut", "otettu käyttöön"]

export async function fetchYmparistolupaSource() {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 12)

  const results: any[] = []
  const seen = new Set<string>()

  for (const term of SEARCH_TERMS) {
    let cases: any[] = []
    try {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        },
        body: JSON.stringify({ query: term }),
      })
      if (!res.ok) continue
      const json = await res.json()
      if (Array.isArray(json)) cases = json
    } catch {
      continue
    }

    for (const c of cases) {
      const key = String(c?.journalNumber ?? c?.id ?? "")
      if (!key || seen.has(key)) continue

      const name = (c?.name || "").replace(/\s+/g, " ").trim()
      if (!name) continue

      const publishedAt = c?.published ? new Date(c.published) : null
      if (publishedAt && publishedAt < cutoffDate) continue

      const lower = name.toLowerCase()
      if (EXCLUDE_KEYWORDS.some((k) => lower.includes(k))) continue

      seen.add(key)

      const municipality = (c?.municipality || "").trim()
      const city = municipality || detectCityFromText(name)
      const region = city ? getMunicipalityByName(city)?.region ?? null : null
      const completed = COMPLETED_KEYWORDS.some((k) => lower.includes(k))

      results.push({
        name,
        description: c?.applicant
          ? `Ympäristölupa-asia (diaarinro ${c.journalNumber}). Hakija: ${c.applicant}.`
          : `Ympäristölupa-asia (diaarinro ${c.journalNumber}).`,
        city: city || null,
        region,
        location: null,
        developer: c?.applicant ?? null,
        permit_number: c?.journalNumber ?? null,
        property_type: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        business_value: "high",
        source_url: CASE_URL(c.id),
        confidence: 0.55,
        completed,
        source_name: "ymparistolupa",
      })
    }
  }

  return results
}
