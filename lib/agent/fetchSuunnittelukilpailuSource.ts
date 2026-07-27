import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

/*
 * Suunnittelukilpailu-lähde (SAFA, Suomen Arkkitehtiliitto).
 *
 * Arkkitehtuurikilpailu on merkittävän julkisen rakennuksen (kampus, museo,
 * kirjasto, koulu, terminaali, kirkko…) KAIKKEIN aikaisin julkinen signaali —
 * hanke on tässä vaiheessa vasta konseptina, vuosia ennen rakennuslupaa tai
 * urakkakilpailutusta. Osa kilpailuista on kutsukilpailuja jotka eivät näy
 * Hilmassa lainkaan. Matala volyymi (muutama käynnissä kerrallaan), mutta
 * jokainen on iso hanke.
 *
 * SAFA listaa käynnissä olevat kilpailut sivulla /kilpailut/ (arkisto erikseen).
 * Kukin kilpailu on oma sivunsa /kilpailu/<slug>/ josta saadaan otsikko ja
 * og:description (järjestäjä, tuomarit, aikataulu). Kaupunki päätellään
 * otsikosta/kuvauksesta. Confidence 0.55, ihminen tarkistaa TIC:issä.
 */

const LIST_URL = "https://www.safa.fi/kilpailut/"
const COMPETITION_LINK_RE =
  /href="(https:\/\/www\.safa\.fi\/kilpailu\/[^"#?]+)"/gi

const MAX_COMPETITIONS = 30

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[-–]\s*Suomen Arkkitehtiliitto.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractMeta(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  )
  return (html.match(re)?.[1] || "").replace(/\s+/g, " ").trim()
}

export async function fetchSuunnittelukilpailuSource() {
  let listHtml = ""
  try {
    const res = await fetch(LIST_URL, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!res.ok) return []
    listHtml = await res.text()
  } catch {
    return []
  }

  const urls = [
    ...new Set(
      [...listHtml.matchAll(COMPETITION_LINK_RE)].map((m) => m[1]),
    ),
  ].slice(0, MAX_COMPETITIONS)

  const results: any[] = []

  for (const url of urls) {
    let html = ""
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
      })
      if (!res.ok) continue
      html = await res.text()
    } catch {
      continue
    }

    const title = cleanTitle(html.match(/<title>([^<]+)<\/title>/i)?.[1] || "")
    if (!title) continue

    const ogDesc = extractMeta(html, "og:description")

    // Kaupunki: ensin otsikosta (esim. "Oulun yliopiston uusi kampus" -> Oulu),
    // sitten kuvauksesta (esim. Itäkeskus -> "Helsingin kaupunki" -> Helsinki).
    const city = detectCityFromText(title) || detectCityFromText(ogDesc)
    const region = city ? getMunicipalityByName(city)?.region ?? null : null

    results.push({
      name: title,
      description: ogDesc
        ? `Arkkitehtuuri-/suunnittelukilpailu (SAFA). ${ogDesc}`
        : "Arkkitehtuuri-/suunnittelukilpailu (SAFA) käynnissä.",
      city: city || null,
      region,
      location: null,
      developer: null,
      permit_number: null,
      property_type: null,
      phase: "Suunnittelukilpailu",
      business_value: "high",
      source_url: url,
      confidence: 0.55,
      completed: false,
      source_name: "suunnittelukilpailu",
    })
  }

  return results
}
