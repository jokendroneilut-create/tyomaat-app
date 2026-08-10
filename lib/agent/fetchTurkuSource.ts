import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { extractDecisionWinners } from "./decisionWinners"
import { inferDecisionPhase, phaseFromTitle } from "./decisionPhase"
import { genericizeDecisionTitle } from "./decisionTitle"

/*
 * Turun päätösjärjestelmä. Neljäs alustaperhe: oma React-sovellus, ei
 * Ahjoa, Dynastya eikä CaseMia.
 *
 * Rajapinta löytyi JS-nipusta, koska selain jumittui sivulla (navigointi
 * aikakatkaisi 300 s) ja jokainen polku palautti saman 622 tavun kuoren.
 * Nipussa oli `baseURL: https://paatokset.turku.fi/api`.
 *
 * KETJU ON KOLMIPORTAINEN:
 *   /toimielimet              toimielimet ryhmiteltyinä, avain on lyhenne
 *   /toimielin/<lyhenne>      kokoukset (tktviiteId, kokPvm)
 *   /poytakirja/<tktviiteId>  { poytakirja, pykalat } - pykälissä on
 *                             tktNimi ja html eli koko asiateksti
 *
 * Hakupäätepiste /api/haku on olemassa mutta palauttaa 500:n kaikilla
 * kokeilluilla parametreilla, joten se ohitetaan. Toimielinketju ei sitä
 * tarvitse.
 */

const BASE = "https://paatokset.turku.fi/api"
const RECENCY_MONTHS = 18

/*
 * Kokousten haku on rajattu per ajo: yksi kokous on oma pyyntönsä ja niitä
 * on kymmeniä toimielintä kohden. Sama kuvio kuin Oulun kaavakerääjässä -
 * jono purkautuu useamman ajon aikana.
 */
const MAX_MEETINGS_PER_RUN = 40

const CONSTRUCTION_SIGNALS = [
  "hankesuunnitel",
  "tarveselvit",
  "toteutussuunnitel",
  "uudisrakenn",
  "peruskorja",
  "perusparann",
  "laajennu",
  "purkami",
  "urakka",
  "urakoits",
  "rakentamis",
  "monitoimital",
  "liikuntahalli",
  "päiväkodin rakent",
  "koulun rakent",
]

const EXCLUDE_PATTERNS = [
  /\blausunto/i,
  /oikaisuvaatimu/i,
  /valtuustoaloit/i,
  /kuntalaisaloit/i,
  /*
   * Aloite kirjoitetaan Turussa muodossa "Valtuutettu Nina Artesola ym.
   * aloite: ...", jolloin sana "valtuustoaloite" ei esiinny lainkaan.
   * Mitattu: yksi aloite kuudesta ensimmaisesta osumasta.
   */
  /\baloite\b/i,
  /\baloitteen\b/i,
  /laillisuus\s+ja\s+päätösvaltaisuus/i,
  /pöytäkirjan\s+tarkast/i,
]

export function isConstructionSubject(subject: string): boolean {
  if (EXCLUDE_PATTERNS.some((re) => re.test(subject))) return false
  const text = subject.toLowerCase()
  return CONSTRUCTION_SIGNALS.some((k) => text.includes(k))
}

/*
 * Pykälän teksti on HTML:ää. Ehdotus ja päätös on merkitty
 * span.ehdotuspaatos-elementeillä, joten tagien poiston jälkeen ne
 * liimautuisivat edelliseen sanaan ilman välilyöntiä.
 */
export function stripPykalaHtml(html: string | null | undefined): string | null {
  if (!html) return null

  const text = html
    .replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[​­]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return text.length >= 80 ? text : null
}

/*
 * Toimielimet tulevat ryhmiteltyinä (kaupunginvaltuusto, lautakunnat,
 * seudulliset, vaikuttajaryhmät...). Lakkautetut jätetään pois - niistä ei
 * tule uusia päätöksiä.
 */
export function collectAbbreviations(payload: any): string[] {
  const out: string[] = []

  for (const [group, value] of Object.entries(payload ?? {})) {
    if (/lakkautetut/i.test(group)) continue

    for (const item of Array.isArray(value) ? value : [value]) {
      const abbr = (item as any)?.lyhenne
      if (typeof abbr === "string" && abbr.trim()) out.push(abbr.trim())
    }
  }

  return [...new Set(out)]
}

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    if (!res.ok) return null
    if (!(res.headers.get("content-type") ?? "").includes("json")) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchTurkuPaatoksetSource() {
  const toimielimet = await getJson("/toimielimet")
  if (!toimielimet) return []

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)

  const results: any[] = []
  const seen = new Set<string>()
  let meetingFetches = 0

  for (const abbr of collectAbbreviations(toimielimet)) {
    if (meetingFetches >= MAX_MEETINGS_PER_RUN) break

    const meetings = await getJson(`/toimielin/${encodeURIComponent(abbr)}`)
    if (!Array.isArray(meetings)) continue

    for (const meeting of meetings) {
      if (meetingFetches >= MAX_MEETINGS_PER_RUN) break

      const date = meeting?.kokPvm ? new Date(meeting.kokPvm) : null
      if (date && date < cutoff) continue

      const meetingId = String(meeting?.tktviiteId ?? "")
      if (!meetingId) continue

      meetingFetches++
      const minutes = await getJson(`/poytakirja/${meetingId}`)
      const pykalat = minutes?.pykalat
      if (!Array.isArray(pykalat)) continue

      for (const pykala of pykalat) {
        const title = String(pykala?.tktNimi ?? "").trim()
        if (!title || !isConstructionSubject(title)) continue

        /*
         * Sama asia käsitellään usein kahdessa toimielimessä, ja pykälän id
         * on eri kummassakin. Deduplikointi otsikosta kuten Dynastyssa ja
         * CaseMissa.
         */
        const key = title.toLowerCase().replace(/[^a-zåäö0-9]+/g, " ").trim()
        if (seen.has(key)) continue
        seen.add(key)

        const description = stripPykalaHtml(pykala?.html)
        // Ilman kuvausta ehdokas hylätään katselmoinnissa (D-027).
        if (!description) continue

        const winners = extractDecisionWinners(description)

        results.push({
          name: genericizeDecisionTitle(title),
          description,
          city: "Turku",
          region: "Varsinais-Suomi",
          location:
            extractStreetAddress(title) ?? extractStreetAddress(description),
          developer: "Turun kaupunki",
          permit_number: String(pykala?.tktviiteId ?? meetingId),
          property_type: inferBuildingType(title, description),
          winners,
          phase: inferDecisionPhase({
            description,
            hasWinner: winners.length > 0,
            fallback: phaseFromTitle(title),
            title,
          }),
          business_value: "high",
          source_url: `https://paatokset.turku.fi/poytakirja/${meetingId}`,
          confidence: 0.6,
          completed: false,
          source_name: "turku_paatokset",
        })
      }
    }
  }

  return results
}
