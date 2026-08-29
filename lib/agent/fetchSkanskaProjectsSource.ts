import * as cheerio from "cheerio"
import { blockText, cutAtFirstMarker, parseScopeFromText, trimTrailingHeadings } from "./htmlBlockText"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * SKANSKAN PROJEKTISIVUT — eri lähde kuin Skanskan uutiset.
 *
 * MIKSI ERIKSEEN. Uutislähde (`skanska`) kertoo hetkestä: mitä juuri nyt
 * julkistettiin. Projektisivu kertoo hankkeen tilan ja osapuolet NIMETTYINÄ
 * KENTTINÄ, ja se pysyy ajan tasalla koko hankkeen ajan.
 *
 * Mitattu tapaus 18.8.2026: Espoon Prismakeskus oli kannassa kahtena
 * STT-tiedotteen pohjalta, ja pääurakoitsija oli vain toisella rivillä.
 * Skanskan oma projektisivu kertoo saman asian yksiselitteisesti:
 * "Asiakas: HOK-Elanto", "Status: Käynnissä", ja julkaisija itse on
 * pääurakoitsija.
 *
 * LISTAUS TULEE SITEMAPISTA, EI LISTAUSSIVULTA. Sivuston oma projektilistaus
 * rakentuu selaimessa eikä palvelin renderöi siitä yhtään linkkiä (todettu:
 * 0 linkkiä raa'assa HTML:ssä). Sitemap sen sijaan luettelee ne suoraan —
 * mitattu 54 suomenkielistä projektisivua 836 sivusta.
 */

const SITEMAP_URL = "https://www.skanska.com/sitemaps/fi/fi/sitemap-pages.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/*
 * Skanska on kansainvälinen ja sitemapissa on myös ulkomaisia kohteita
 * (esim. "nackan-metrotunneli"). Palvelu on Suomen työmaista, joten
 * kaupungin tunnistus ratkaisee: ilman suomalaista kuntaa kohde jätetään.
 */
const FOREIGN_HINTS = /nacka|stockholm|oslo|göteborg|malmö|köpenhamn|london/i

/* Sivun tila-kenttä kertoo vaiheen suoraan, arvausta ei tarvita. */
const STATUS_TO_PHASE: Record<string, string> = {
  käynnissä: PHASE_LABELS.construction,
  valmis: PHASE_LABELS.completed,
  valmistunut: PHASE_LABELS.completed,
  suunnitteilla: PHASE_LABELS.planning,
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export async function fetchSkanskaProjectsSource() {
  const response = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const xml = await response.text()

  const urls = Array.from(xml.matchAll(/<loc>([^<]*\/projektimme\/[^<]+)<\/loc>/g))
    .map((m) => m[1])
    .filter((url) => !url.endsWith("/projektimme/"))

  const seen = new Set<string>()
  const results: any[] = []

  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)

    const slug = url.split("/projektimme/")[1]?.replace(/\/$/, "") ?? ""
    if (!slug || FOREIGN_HINTS.test(slug)) continue

    const name = titleFromSlug(slug)

    results.push({
      name,
      city: detectCityFromText(name),
      region: null,
      location: null,
      /* Todellinen vaihe luetaan sivun Status-kentästä rikastuksessa. */
      phase: PHASE_LABELS.planning,
      source_url: url,
      confidence: 0.7,
      completed: false,
      source_name: "skanska_projektit",
    })
  }

  return results
}

/*
 * Projektisivun nimetyt kentät.
 *
 * Sivu esittää ne muodossa "Asiakas: HOK-Elanto Palvelu: ... Hanketyyppi:
 * ... Urakkamuoto: ...", joten arvo on seuraavan otsikon alkuun asti.
 */
const FIELD_LABELS = ["Asiakas", "Palvelu", "Hanketyyppi", "Urakkamuoto", "Status"]

export function extractSkanskaField(text: string, label: string): string | null {
  const others = FIELD_LABELS.filter((l) => l !== label).join("|")
  const match = text.match(
    /*
     * KAKSOISKENOVIIVA ON PAKOLLINEN. Template-literaalissa yksi
     * kenoviiva katoaa, jolloin whitespace-luokasta tulee kirjain "s" —
     * ja `i`-lipun kanssa se söi arvon alkukirjaimen: "Skanska Kodit"
     * poimiutui muodossa "kanska Kodit" (mitattu 19.8.2026).
     *
     * Testi ei paljastanut tätä, koska siinä oli välilyönti
     * kaksoispisteen jälkeen eikä väärä kuvio osunut mihinkään.
     */
    new RegExp(`${label}:\\s*(.+?)(?=\\s*(?:${others}):|$)`, "i")
  )

  const value = match?.[1]?.trim()
  return value && value.length > 1 && value.length < 120 ? value : null
}

export async function enrichSkanskaProject(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  const response = await fetch(candidate.source_url, { headers: { "User-Agent": UA } })
  if (!response.ok) return candidate

  const rawHtml = await response.text()
  const $ = cheerio.load(rawHtml)
  $("script, style, noscript, nav, header, footer").remove()

  const text = $("main").text().replace(/\s+/g, " ").trim() || $("body").text().replace(/\s+/g, " ").trim()

  const client = extractSkanskaField(text, "Asiakas")
  /*
   * Status on sivulla ILMAN kaksoispistettä ja ILMAN välilyöntiä:
   * cheerio yhdistää elementit erottimetta, joten teksti on muodossa
   * "StatusKäynnissäProjektin tiedot". Arvo on siis heti otsikon perässä
   * ja alkaa isolla kirjaimella.
   */
  const status = text.match(/Status\s*([A-ZÅÄÖ][a-zåäö]+)/)?.[1] ?? null
  const projectType = extractSkanskaField(text, "Hanketyyppi")

  /*
   * Laajuus: rakenteinen "Koko"-kentta ensin, leipateksti varalla.
   * Firdon 19 000 brm2 luki vain kuvauksessa, joten se jai poimimatta.
   */
  /*
   * "Koko"-kentta on erottimettomassa tekstissa, joten se nappaa
   * helposti viereiset kentat mukaan: Hotel Grand Hansalla arvoksi tuli
   * "Aloitus:Valmistuminen:Kehitysvaihe:2/2021-5/2021". Siksi arvon on
   * NAYTETTAVA pinta-alalta, ei pelkastaan sisallettava numero.
   */
  /*
   * LAAJUUS ON UPOTETUSSA JSONISSA, EI TEKSTISSA.
   *
   * Firdon sivu nayttaa "19 000 brm²" vasta selaimessa: palvelimen
   * palauttamassa HTML:ssa luku on JSON-lohkossa muodossa
   * "Size":"19 000 brm²". Siksi sita ei loytynyt tekstista lainkaan, ja
   * hankkeen mittaluokka jai poimimatta.
   *
   * Rakenteinen kentta on luotettavampi kuin leipatekstista arvaaminen,
   * joten se luetaan ensin.
   */
  /*
   * Lainausmerkit ovat JSON-lohkossa kenoviivalla suojattuja
   * (\"Size\":\"19 000 brm²\"), joten molemmat muodot on sallittava.
   */
  const sizeFromJson =
    /\\?"Size\\?"\s*:\s*\\?"([^"\\]{1,60})\\?"/.exec(rawHtml)?.[1]?.trim() || null

  const sizeField = extractSkanskaField(text, "Koko")
  const kentanScope =
    sizeField && /\d/.test(sizeField) && /(brm|m2|m²|neliö|kerrosala)/i.test(sizeField)
      ? sizeField
      : null

  const scope = sizeFromJson && /\d/.test(sizeFromJson) ? sizeFromJson : kentanScope

  /*
   * Kuvaus alkaa "Projektin tiedot" -otsikon jälkeen; sitä ennen on
   * navigaatiota ja murupolku.
   */
  /*
   * KUVAUS KOOTAAN LOHKOITTAIN, KENTAT EI.
   *
   * Ylla oleva `text` on tarkoituksella erottimeton, koska
   * kenttapoiminta nojaa siihen ("StatusKaynnissa"). Kuvaukselle se on
   * kuitenkin vaara: Firdossa syntyi "Asiakas:MonikayttajataloPalvelu:"
   * ja loppuun liimautui maavalitsin.
   */
  const lohkot = blockText($)
  const detailsAt = lohkot.search(/Projektin tiedot/i)
  const raakaKuvaus =
    detailsAt >= 0 ? lohkot.slice(detailsAt + "Projektin tiedot".length).trim() : lohkot

  /*
   * Sivun hantaan jaa upotuksia joita nav/footer-poisto ei tavoita:
   * karttaupotus ja maavalitsin. Katkaistaan ensimmaisesta.
   */
  const description = trimTrailingHeadings(
    cutAtFirstMarker(
      raakaKuvaus,
      /(Kuvia\s+Sijainti|Sijainti\s+Aktivoi kartta|Aktivoi kartta|Valitse maa|Siirry Group sivustolle|Loading\.\.\.)/i
    )
  )

  const scopeFromText = parseScopeFromText(description)

  const phase = status
    ? STATUS_TO_PHASE[status.toLowerCase().split(/\s/)[0]] ?? candidate.phase
    : candidate.phase

  return {
    ...candidate,
    description: description.slice(0, 4000),
    city: candidate.city ?? detectCityFromText(description),
    location: candidate.location ?? extractStreetAddress(description),
    /* Asiakas on tilaaja eli rakennuttaja. */
    developer: candidate.developer ?? client,
    /* Julkaisija on määritelmän mukaan pääurakoitsija tällä sivustolla. */
    builder: candidate.builder ?? "Skanska",
    phase,
    property_type:
      candidate.property_type ??
      inferBuildingType(candidate.name, `${projectType ?? ""} ${description}`),
    metadata: {
      ...(candidate.metadata ?? {}),
      field_sources: {
        developer: client ? "teksti" : null,
        builder: "julkaisija",
        phase: status ? "teksti" : null,
        city: "teksti",
        laajuus: scope ? "lähde" : scopeFromText ? "teksti" : null,
      },
      ...(projectType ? { skanska_hanketyyppi: projectType } : {}),
      /* Rakenteinen kentta ensin, leipateksti varalla. */
      ...(scope || scopeFromText ? { laajuus: scope ?? scopeFromText } : {}),
    },
  }
}
