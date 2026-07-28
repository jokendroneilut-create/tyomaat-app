import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { fetchJsonWithFallback } from "./fetchJsonWithFallback"

/*
 * Yhteinen apuri STT Infon uutishuone-lähteille (Hartela, Skanska, GRK,
 * Jatke, Tekova, Meijou, Espoon Asunnot...). Kaikki lukevat saman
 * pressroom-listaus-API:n ja eroavat vain julkaisija-ID:llä ja
 * avainsanasuodattimilla. Apuri hoitaa myös:
 *  - koko tiedotteen tekstin haun kuvaukseksi (per-tiedote-API, body.complete)
 *  - maakunnan johtamisen kunnasta (getMunicipalityByName)
 */

export type SttPressroomConfig = {
  publisherId: string
  sourceName: string
  projectKeywords: string[]
  excludeKeywords: string[]
  /** Oletus: valmistui/valmistunut/luovutettu/otettu käyttöön. */
  completedKeywords?: string[]
  referer?: string
  /** Kuinka monta kuukautta taaksepäin otetaan mukaan (oletus 24). */
  monthsBack?: number
  /** Kuinka monta listaussivua käydään läpi (oletus 6). */
  pages?: number
}

const DEFAULT_COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "luovutettu",
  "otettu käyttöön",
]

function stripInline(value: unknown): string | null {
  const text = typeof value === "string" ? value : ""
  return (
    text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  )
}

/*
 * HTML-runko -> luettava monirivinen teksti: kappale-/rivitagit muutetaan
 * rivinvaihdoiksi, muut tagit poistetaan, yleisimmät entiteetit puretaan.
 */
function htmlToText(value: unknown): string {
  const html = typeof value === "string" ? value : ""
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;|&#39;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type ReleaseDetail = {
  bodyText: string
  lead: string
  keywords: string
}

/*
 * Listaus-API antaa vain otsikon ja lyhyen metadescriptionin. Koko teksti
 * on saatavilla vain per-tiedote-API:sta, jonka versions.fi.body.complete
 * sisältää HTML-rungon.
 */
async function fetchReleaseDetail(
  publisherId: string,
  id: unknown,
  referer: string
): Promise<ReleaseDetail | null> {
  if (id == null) return null

  try {
    const data = await fetchJsonWithFallback(
      `https://www.sttinfo.fi/public-website-api/release/${id}?publisherId=${publisherId}&lang=fi`,
      referer
    )

    const fi = data?.versions?.fi
    if (!fi) return null

    // body voi olla { complete: "<p>...</p>" } tai poikkeustapauksessa merkkijono.
    const bodyHtml =
      typeof fi.body === "string" ? fi.body : fi.body?.complete ?? ""

    return {
      bodyText: htmlToText(bodyHtml),
      lead: htmlToText(fi.leadtext),
      keywords: typeof fi.keywords === "string" ? fi.keywords : "",
    }
  } catch {
    return null
  }
}

export async function fetchSttPressroomProjects(
  config: SttPressroomConfig
): Promise<any[]> {
  const {
    publisherId,
    sourceName,
    projectKeywords,
    excludeKeywords,
    completedKeywords = DEFAULT_COMPLETED_KEYWORDS,
    referer = `https://www.sttinfo.fi/uutishuone/${publisherId}`,
    monthsBack = 24,
    pages = 6,
  } = config

  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack)

  for (let page = 0; page < pages; page++) {
    let data: any
    try {
      data = await fetchJsonWithFallback(
        `https://www.sttinfo.fi/public-website-api/pressroom/${publisherId}/releases/20/${page}`,
        referer
      )
    } catch {
      break
    }

    const releases = data?.releases || []
    if (!releases.length) break

    for (const release of releases) {
      const fi = release?.versions?.fi
      const title = (fi?.title || "").trim()
      const metaDescription = stripInline(fi?.metadescription)
      const relativeUrl = fi?.url || ""

      if (!title || !relativeUrl) continue

      const releaseDate = release?.date ? new Date(release.date) : null
      if (releaseDate && releaseDate < cutoffDate) {
        continue
      }

      const lowerTitle = title.toLowerCase()

      if (!projectKeywords.some((k) => lowerTitle.includes(k))) continue
      if (excludeKeywords.some((k) => lowerTitle.includes(k))) continue

      const absoluteHref = relativeUrl.startsWith("http")
        ? relativeUrl
        : `https://www.sttinfo.fi${relativeUrl}`

      const completed = completedKeywords.some((k) => lowerTitle.includes(k))

      /*
       * Haetaan koko tiedotteen teksti kuvaukseksi. Vain suodatuksen
       * läpäisseille (muutama per ajo), joten lisäkutsuja on vähän.
       */
      const detail = await fetchReleaseDetail(publisherId, release.id, referer)

      const leadText = detail?.lead || metaDescription || ""
      const description = detail?.bodyText
        ? leadText && !detail.bodyText.startsWith(leadText)
          ? `${leadText}\n\n${detail.bodyText}`
          : detail.bodyText
        : metaDescription

      /*
       * Kaupunki otsikosta; jos ei löydy, kokeillaan koko tekstiä ja
       * avainsanoja (STT:n keywords sisältää usein kunnan nimen).
       * Maakunta johdetaan kunnasta.
       */
      const cityHaystack = `${title} ${leadText} ${detail?.bodyText ?? ""} ${detail?.keywords ?? ""}`
      const city =
        detectCityFromText(title) ?? detectCityFromText(cityHaystack)
      const region = getMunicipalityByName(city)?.region ?? null

      results.push({
        name: title,
        description,
        city,
        region,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: absoluteHref,
        confidence: 0.6,
        completed,
        source_name: sourceName,
      })
    }
  }

  return results
}
