import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * HARTELAN TULEVAT ASUINALUEET.
 *
 * ERI SIVU KUIN REFERENSSIT. Kartoituksessa 19.8.2026 tarkistin Hartelalta
 * vain `/referenssit`, joka on valmistuneita kohteita eikä tuottanut
 * mitään. Nämä ovat päinvastoin TULEVIA: alueita joille Hartela
 * suunnittelee ja rakentaa asuntoja.
 *
 * MIKSI TÄMÄ ON ARVOKAS: OSOITTEET. Mitattu kaikilta 15 sivulta:
 * katuosoite talonumeroineen löytyy 8:lta. Osoite on
 * duplikaattitäsmäytyksen vahvin avain ja puuttuu käytännössä kaikilta
 * muilta yrityslähteiltä — tämä lähde löytyi juuri siksi, että käyttäjä
 * joutui lisäämään Ukonkellontie 6:n käsin.
 *
 * NIMI OTETAAN TALOYHTIÖSTÄ, EI OTSIKOSTA. Sivun `h1` on muotoa
 * "Kirkkonummi, Sarvvik" eli kaupunki ja kaupunginosa — se ei yksilöi
 * hanketta. Varsinainen nimi on omana väliotsikkonaan ("Asunto Oy
 * Sarvvikin Ukonkello Kirkkonummi"), ja se käytetään kun se löytyy.
 */

const LISTING_URL = "https://hartela.fi/fi/asunnot/tulevat-asuinalueet"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Sivuja on 15 ja ne ovat pieniä, joten haku tekee kaiken kerralla. */
const CONCURRENCY = 5

/* "Asunto Oy Sarvvikin Ukonkello Kirkkonummi" */
const HOUSING_COMPANY = /^(Asunto\s+Oy|As\.?\s*Oy)\s+.{4,}/i

/*
 * OTSIKON JÄRJESTYS VAIHTELEE, joten molemmat puolet on kokeiltava.
 * Sivuilla on sekä "Kirkkonummi, Sarvvik" (kunta ensin) että
 * "Lauttasaari, Helsinki" (kaupunginosa ensin). Pelkkä pilkkua edeltävä
 * osa antoi kunnan vain 7 sivulta 15:stä (mitattu 19.8.2026).
 *
 * Osaa kokeillaan erikseen eikä koko otsikkoa kerralla, jottei
 * kaupunginosan nimi osuisi samannimiseen kuntaan muualla Suomessa.
 */
export function cityFromHartelaHeading(heading: string): string | null {
  const parts = heading.split(",").map((part) => part.trim())

  /*
   * TÄSMÄLLINEN NIMI ENSIN. Otsikon osa on kokonaisuudessaan kunnan nimi
   * ("Oulu, Karjasillan Kulma"), joten suora vertailu kuntaluetteloon on
   * yksiselitteinen. Sitä tarvitaan, koska kaupunkitunnistin vaatii alle
   * 5-kirjaimisilta kunnilta taivutuspäätteen — pelkkä "Oulu" ei tunnistu,
   * ja sääntö on siellä syystä ("Ii" osuisi muuten roomalaiseen numeroon).
   *
   * Rajaus kokonaiseen otsikon osaan tekee tästä turvallista: sama
   * löysennys jaettuun tunnistimeen toisi mukanaan 12 lyhyttä kuntaa,
   * joista "Aura" ja "Simo" osuisivat yritys- ja henkilönimiin.
   */
  for (const part of parts) {
    const exact = getMunicipalityByName(part)
    if (exact) return exact.name
  }

  for (const part of parts) {
    const city = detectCityFromText(part)
    if (city) return city
  }

  return null
}

export function projectNameFromHeadings(
  headings: string[],
  fallback: string
): string {
  const named = headings.find((h) => HOUSING_COMPANY.test(h.trim()))
  return named ? named.trim() : fallback
}

export async function fetchHartelaAreasSource() {
  const response = await fetch(LISTING_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const $ = cheerio.load(await response.text())

  const urls = [
    ...new Set(
      $('a[href*="/tulevat-asuinalueet/"]')
        .map((_, el) => $(el).attr("href") ?? "")
        .get()
    ),
  ]
    .filter((url) => url && !/tulevat-asuinalueet\/?$/.test(url))
    .map((url) => (url.startsWith("http") ? url : `https://hartela.fi${url}`))

  const results: any[] = []
  let cursor = 0

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++]

        try {
          const page = await fetch(url, { headers: { "User-Agent": UA } })
          if (!page.ok) continue

          const p = cheerio.load(await page.text())

          const heading = p("h1").first().text().replace(/\s+/g, " ").trim()
          if (!heading) continue

          const headings = p("h2, h3")
            .map((_, el) => p(el).text().replace(/\s+/g, " ").trim())
            .get()

          p("script, style, noscript, nav, header, footer").remove()

          /*
           * Selainkehotus on sivun ensimmäinen teksti eikä kuulu kuvaukseen.
           */
          const description = p("body")
            .text()
            .replace(/\s+/g, " ")
            .replace(/^Ole hyvä ja päivitä selaimesi[^.]*\.\s*/i, "")
            .trim()
            .slice(0, 4000)

          const name = projectNameFromHeadings(headings, heading)

          results.push({
            name,
            city:
              cityFromHartelaHeading(heading) ??
              detectCityFromText(extractStreetAddress(description) ?? ""),
            region: null,
            location: extractStreetAddress(description),
            /*
             * Sivun nimi on "tulevat asuinalueet" ja tekstit puhuvat
             * suunnitteilla olevista kodeista, joten vaihe on suunnittelu.
             */
            phase: PHASE_LABELS.planning,
            description,
            /* Hartela on näillä sivuilla oman tuotantonsa rakentaja. */
            builder: "Hartela",
            property_type: inferBuildingType(name, description),
            source_url: url,
            confidence: 0.7,
            completed: false,
            source_name: "hartela_asuinalueet",
          })
        } catch {
          /* Yksittäisen sivun kaatuminen ei saa kaataa koko hakua. */
        }
      }
    })
  )

  return results
}
