import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

const PUBLISHER_ID = "1812"

/*
 * STT Infon listaus-API palauttaa vain otsikon ja lyhyen metadescriptionin.
 * Koko tiedotteen teksti on saatavilla vain per-tiedote-API:sta
 * (release/{id}), jonka versions.fi.body.complete sisältää HTML-rungon.
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

async function fetchReleaseDetail(id: unknown): Promise<ReleaseDetail | null> {
  if (id == null) return null

  try {
    const res = await fetch(
      `https://www.sttinfo.fi/public-website-api/release/${id}?publisherId=${PUBLISHER_ID}&lang=fi`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.sttinfo.fi/uutishuone/1812/hartela",
        },
      }
    )

    if (!res.ok) return null

    const data = await res.json()
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

export async function fetchHartelaSource() {
  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 0; page < 6; page++) {
    const res = await fetch(
      `https://www.sttinfo.fi/public-website-api/pressroom/1812/releases/20/${page}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.sttinfo.fi/uutishuone/1812/hartela",
        },
      }
    )

    if (!res.ok) break

    const data = await res.json()
    const releases = data?.releases || []

    if (!releases.length) break

    for (const release of releases) {
      const fi = release?.versions?.fi
      const title = (fi?.title || "").trim()
      const metaDescription =
        (fi?.metadescription || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim() || null
      const relativeUrl = fi?.url || ""

      if (!title || !relativeUrl) continue

      const releaseDate = release?.date ? new Date(release.date) : null
      if (releaseDate && releaseDate < cutoffDate) {
        continue
      }

      const lowerTitle = title.toLowerCase()

      const projectKeywords = [
        "rakentaa",
        "rakentaminen",
        "rakentuu",
        "toteuttaa",
        "peruskorjaus",
        "peruskorjauksen",
        "hanke",
        "kohde",
        "asunto",
        "asuntoa",
        "asunnot",
        "kodit",
        "kortteli",
        "toimitila",
        "toimitilat",
        "koulu",
        "päiväkoti",
        "sairaala",
        "palvelukortteli",
        "palvelutalo",
        "hoivakoti",
        "uudiskohde",
      ]

      const excludeKeywords = [
        "nimity",
        "osavuosikatsaus",
        "tilinpäätös",
        "markkina",
        "tulos",
        "vastuullisuus",
        "johtaja",
      ]

      if (!projectKeywords.some((k) => lowerTitle.includes(k))) continue
      if (excludeKeywords.some((k) => lowerTitle.includes(k))) continue

      const absoluteHref = relativeUrl.startsWith("http")
        ? relativeUrl
        : `https://www.sttinfo.fi${relativeUrl}`

      const completedKeywords = [
        "valmistui",
        "valmistunut",
        "luovutettu",
        "otettu käyttöön",
      ]

      const completed = completedKeywords.some((k) =>
        lowerTitle.includes(k)
      )

      /*
       * Haetaan koko tiedotteen teksti kuvaukseksi. Vain suodatuksen
       * läpäisseille (muutama per ajo), joten lisäkutsuja on vähän.
       */
      const detail = await fetchReleaseDetail(release.id)

      const leadText = detail?.lead || metaDescription || ""
      const description =
        detail?.bodyText
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
        source_name: "hartela",
      })
    }
  }

  return results
}
