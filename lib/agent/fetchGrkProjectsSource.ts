import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { extractExplicitClient } from "./fetchSttHakuSource"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * GRK:N PROJEKTISIVUT — infrahankkeita, eri lähde kuin GRK:n uutiset.
 *
 * MIKSI TÄMÄ KANNATTAA vaikka sivuilla EI OLE nimettyjä kenttiä toisin
 * kuin NCC:llä ja Skanskalla: GRK on iso infratoimija (tiet, sillat,
 * radat, kunnallistekniikka), ja infrassa kattavuutemme on ohuempi kuin
 * talonrakentamisessa. 239 nimettyä hanketta on kartoituksen suurin
 * yksittäinen löytö (mitattu 19.8.2026).
 *
 * VAIN KÄYNNISSÄ OLEVAT. Sivut ovat pääosin historiaa: 40 sivun otoksesta
 * yksikään ei maininnut vuotta 2025 tai uudempaa, ja koko joukosta vain
 * 40/239 mainitsee 2026 tai myöhemmän. Valmistuneet referenssit eivät ole
 * mahdollisuuksia, ja jonoon tuotuina ne hukuttaisivat käynnissä olevat
 * alleen — sama päätös kuin Lujatalolla.
 *
 * EI ERILLISTÄ RIKASTUSKOUKKUA. Sivut ovat pieniä (700-1600 merkkiä) ja
 * koko joukon haku vie rinnakkain 7,9 s, joten haku tekee kaiken kerralla.
 * Näin poiminta ei ole `ENRICH_PER_RUN`-katon takana eikä odota
 * runkotyöntekijää.
 */

const SITEMAP_URL = "https://www.grk.fi/reference-sitemap.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Sivuja on satoja mutta ne ovat kevyitä; tämä pitää ajon alle 10 s. */
const CONCURRENCY = 8

/*
 * GRK toimii myös Ruotsissa, Virossa ja Liettuassa, ja sitemapissa on
 * niiden sivuja. Suomalaisen kunnan tunnistus on luotettavampi rajaus kuin
 * kielikohtaiset sanalistat.
 */
export function isFinnishGrkProject(text: string): boolean {
  return Boolean(detectCityFromText(text))
}

/*
 * Käynnissä olevaksi luetaan hanke, jonka teksti mainitsee kuluvan tai
 * tulevan vuoden. Sivuilla ei ole tilakenttää, joten vuosi on ainoa
 * käytettävissä oleva merkki.
 */
export function grkMentionsFutureYear(text: string, currentYear: number): boolean {
  const years = Array.from(text.matchAll(/(20[0-3]\d)/g))
    .map((m) => Number(m[1]))
    .filter((y) => y <= currentYear + 8)

  return years.length > 0 && Math.max(...years) >= currentYear
}

export async function fetchGrkProjectsSource() {
  const sitemapResponse = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!sitemapResponse.ok) return []

  const xml = await sitemapResponse.text()

  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
    .map((m) => m[1])
    .filter((url) => url.includes("/projektit/") && !url.endsWith("/projektit/"))
    /* Vieraskieliset polut pois jo ennen hakua. */
    .filter((url) => !/\/(en|sv|et|lt)\//.test(url))

  const currentYear = new Date().getFullYear()
  const results: any[] = []

  let cursor = 0

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++]

        try {
          const response = await fetch(url, { headers: { "User-Agent": UA } })
          if (!response.ok) continue

          const $ = cheerio.load(await response.text())
          $("script, style, noscript, nav, header, footer").remove()

          const name = $("h1").first().text().replace(/\s+/g, " ").trim()
          if (!name) continue

          const text = $("body").text().replace(/\s+/g, " ").trim()

          /*
           * Murupolku "GRK Projektit <otsikko>" on tekstin alussa; se ei
           * kuulu kuvaukseen eikä saa päätyä osapuolten poimintaan.
           */
          const description = text.replace(/^GRK\s+Projektit\s+/i, "").trim()

          if (!isFinnishGrkProject(description)) continue
          if (!grkMentionsFutureYear(description, currentYear)) continue

          results.push({
            name,
            city: detectCityFromText(name) ?? detectCityFromText(description),
            region: null,
            location: extractStreetAddress(description),
            phase: PHASE_LABELS.construction,
            description: description.slice(0, 4000),
            /* Tilaaja vain yksiselitteisestä maininnasta, ei arvauksesta. */
            developer: extractExplicitClient(description),
            /* Julkaisija on pääurakoitsija omilla projektisivuillaan. */
            builder: "GRK",
            property_type: inferBuildingType(name, description),
            source_url: url,
            confidence: 0.65,
            completed: false,
            source_name: "grk_projektit",
          })
        } catch {
          /* Yksittäisen sivun kaatuminen ei saa kaataa koko hakua. */
        }
      }
    })
  )

  return results
}
