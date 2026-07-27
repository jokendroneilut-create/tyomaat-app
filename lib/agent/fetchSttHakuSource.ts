import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

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

      results.push({
        name: title,
        description,
        city,
        region,
        location: null,
        developer: release?.publisher?.name ?? null,
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
