import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { housingCompanyName } from "@/lib/projects/housingCompanyKey"

/*
 * LAPTIN TALOYHTIÖT — OMAPERUSTEINEN ASUNTOTUOTANTO.
 *
 * Lähde `lapti` lukee uutissivun (`/ajankohtaista/`), eli urakkavoitot
 * ja tiedotteet. Omaperusteinen asuntotuotanto ei näy siellä: urakkaa ei
 * kilpailuteta, koska Lapti rakentaa itselleen ja myy asunnot. Sama
 * katve kuin Lujatalolla (D-172).
 *
 * Taloyhtiöt ovat sivustolla OMANA SISÄLTÖTYYPPINÄÄN
 * (`pdx_housingcompany`), ja jokaisella sivulla on sama nimetty
 * kenttätaulukko. Mitattu 6.9.2026: 21 kenttää joka sivulla, mm.
 * Taloyhtiön nimi, Katuosoite, Rakentaja, Rakennustyyppi, Asuntojen
 * määrä, Arvioitu valmistusaika, Energialuokka. Mikään nykyinen
 * lähteemme ei anna tätä.
 *
 * 67 osoitetta on 49 taloyhtiötä (sama yhtiö toistuu sitemapissa), 31
 * valmistunut ja 18 kesken. Kesken olevista neljä oli jo kannassa.
 *
 * robots.txt sallii kaiken eikä aseta Crawl-delayta.
 */

const SITEMAP_URL = "https://lapti.fi/pdx_housingcompany-sitemap.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/*
 * VAIHE LUETAAN PORTAASTA, EI TEKSTISTÄ.
 *
 * Sivu piirtää nelivaiheisen portaan ja korostaa nykyisen vaiheen
 * `orange-bg`-luokalla; muut ovat `lightgray-bg`. Kaikki neljä nimeä
 * esiintyvät siis joka sivulla, joten tekstihaku antaisi aina saman
 * vastauksen. Sama ansa kuin Lujakodilla, jossa markkinointilause
 * "johon on rakenteilla 45 asuntoa" teki ennakkomarkkinoinnissa
 * olevasta kohteesta rakenteilla olevan (D-172).
 */
const VAIHEET: { kuvio: RegExp; vaihe: string | null }[] = [
  { kuvio: /muuttovalmis/i, vaihe: null },
  { kuvio: /rakenteilla/i, vaihe: PHASE_LABELS.construction },
  { kuvio: /ennakkomarkkinoin/i, vaihe: PHASE_LABELS.planning },
  { kuvio: /suunnitteilla/i, vaihe: PHASE_LABELS.planning },
]

export function vaihePortaasta(tila: string | null | undefined): string | null {
  const t = String(tila ?? "")
  for (const { kuvio, vaihe } of VAIHEET) {
    if (kuvio.test(t)) return vaihe
  }
  return null
}

/*
 * "12/2027" -> "2027-12-31", "2027" -> "2027-12-31".
 *
 * Kuukauden viimeinen päivä, kuten muissakin arvioissa: lähde antaa
 * kuukauden tarkkuuden eikä päivää saa keksiä.
 */
export function valmistumispaiva(arvo: string | null | undefined): string | null {
  const teksti = String(arvo ?? "")

  const kk = teksti.match(/\b(\d{1,2})\s*\/\s*(20\d{2})\b/)
  if (kk) {
    const kuukausi = Number(kk[1])
    if (kuukausi < 1 || kuukausi > 12) return null
    const viimeinen = new Date(Date.UTC(Number(kk[2]), kuukausi, 0)).getUTCDate()
    return `${kk[2]}-${String(kuukausi).padStart(2, "0")}-${viimeinen}`
  }

  const vuosi = teksti.match(/\b(20\d{2})\b/)
  return vuosi ? `${vuosi[1]}-12-31` : null
}

/*
 * "Hämeenkatu 5, 40100, Jyväskylä" -> "Jyväskylä". Postinumero ei ole
 * kaupunki, joten pelkkä viimeinen pala ei riitä varmuudella.
 */
export function kaupunkiOsoitteesta(osoite: string | null | undefined): string | null {
  const palat = String(osoite ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{5}$/.test(p))

  const viimeinen = palat[palat.length - 1]
  return viimeinen ? detectCityFromText(viimeinen) : null
}

export type LaptiKohde = {
  nimi: string
  osoite: string | null
  kaupunki: string | null
  vaihe: string | null
  tila: string | null
  rakentaja: string | null
  tyyppi: string | null
  asuntoja: number | null
  valmistuu: string | null
  energialuokka: string | null
  kuvaus: string
}

export function parseLaptiPage(html: string): LaptiKohde | null {
  const $ = cheerio.load(html)

  /* Kenttäparit: col-md-4 on otsikko, sitä seuraava col-md-8 on arvo. */
  const kentat = new Map<string, string>()
  $("div.col-md-4").each((_, el) => {
    const otsikko = $(el).text().replace(/\s+/g, " ").trim()
    const arvo = $(el).next("div.col-md-8").text().replace(/\s+/g, " ").trim()
    if (otsikko && arvo && otsikko.length < 40) kentat.set(otsikko, arvo)
  })

  const nimi =
    kentat.get("Taloyhtiön nimi") ||
    $("h1 .name").first().text().replace(/\s+/g, " ").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim()

  if (!nimi) return null

  const tila =
    $("#housingcompany-state li.orange-bg .state-name").first().text().replace(/\s+/g, " ").trim() ||
    null

  const osoite = kentat.get("Katuosoite") ?? null

  const asuntojaTeksti = kentat.get("Asuntojen määrä") ?? ""
  const asuntoja = Number(asuntojaTeksti.match(/\d{1,4}/)?.[0] ?? NaN)

  const kuvaus = $("article p, .entry-content p, main p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 40)
    .join(" ")
    .slice(0, 4000)

  return {
    nimi,
    osoite,
    kaupunki: kaupunkiOsoitteesta(osoite) ?? detectCityFromText(nimi),
    vaihe: vaihePortaasta(tila),
    tila,
    rakentaja: kentat.get("Rakentaja") ?? null,
    tyyppi: kentat.get("Rakennustyyppi") ?? null,
    asuntoja: Number.isFinite(asuntoja) && asuntoja > 0 ? asuntoja : null,
    valmistuu: valmistumispaiva(kentat.get("Arvioitu valmistusaika")),
    energialuokka: kentat.get("Energialuokka") ?? null,
    kuvaus,
  }
}

/*
 * KELPOISUUS. Sivustolla on kolmenlaisia sivuja, ja vain yksi niistä
 * on hankelöytö:
 *
 * 1. Valmistuneet kohteet (31/49) — historiaa, ei mahdollisuus.
 * 2. Markkinointisivut ilman päivämäärää (9/18 "kesken" olevista) —
 *    korttelisivuja ja autohallipaikkoja, joilla ei ole vaihetta eikä
 *    valmistumisaikaa. Näistä ei voi sanoa onko hanke edes olemassa.
 * 3. Päivätyt kesken olevat kohteet — nämä otetaan.
 *
 * Siksi vaaditaan sekä vaihe portaasta ETTÄ tulevaisuuden
 * valmistumisaika. Kumpikaan yksin ei riitä: portaan voi jättää
 * päivittämättä ja vanha sivu voi jäädä "rakenteilla"-tilaan.
 */
export function onAjankohtainen(kohde: LaptiKohde, nyt = new Date()): boolean {
  if (!kohde.vaihe) return false
  if (!kohde.valmistuu) return false
  return kohde.valmistuu >= nyt.toISOString().slice(0, 10)
}

async function haeSitemap(): Promise<string[]> {
  const response = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes("/asuntoyhtio/"))
}

export async function fetchLaptiKohteetSource() {
  const urls = await haeSitemap()
  const results: any[] = []

  /* Sama yhtiö on sitemapissa useaan kertaan (67 osoitetta, 49 yhtiötä). */
  const nahdyt = new Set<string>()

  for (const url of urls) {
    let html: string
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA } })
      if (!response.ok) continue
      html = await response.text()
    } catch {
      continue
    }

    const kohde = parseLaptiPage(html)
    if (!kohde || !onAjankohtainen(kohde)) continue

    /*
     * TARKKA NIMI, EI AVAIN. Avain pudottaa nimen lopun numeron
     * ("…Aarneenkallionkatu 7"), jolloin kaksi eri taloyhtiota voisi
     * nayttaa samalta ja toinen jaisi pois. Sitemapin toistot ovat
     * saman nimen toistoja, joten tarkka nimi riittaa niihin.
     */
    const avain = kohde.nimi.toLowerCase().replace(/\s+/g, " ").trim()
    if (nahdyt.has(avain)) continue
    nahdyt.add(avain)

    const taloyhtio = housingCompanyName(kohde.nimi, kohde.kuvaus)

    results.push({
      name: kohde.nimi,
      city: kohde.kaupunki,
      region: null,
      location: kohde.osoite,
      phase: kohde.vaihe,
      description: kohde.kuvaus,
      /* Omaperusteinen: sama yhtiö rakentaa ja rakennuttaa. */
      builder: kohde.rakentaja ?? "Rakennusliike Lapti Oy",
      developer: kohde.rakentaja ?? "Rakennusliike Lapti Oy",
      property_type: kohde.tyyppi,
      estimated_completion: kohde.valmistuu,
      source_url: url,
      confidence: 0.8,
      source_name: "lapti_kohteet",
      metadata: {
        ...(taloyhtio ? { housing_company: taloyhtio, related_companies: [taloyhtio] } : {}),
        ...(kohde.asuntoja ? { apartments: kohde.asuntoja } : {}),
        ...(kohde.energialuokka ? { energialuokka: kohde.energialuokka } : {}),
        ...(kohde.tila ? { myyntitila: kohde.tila } : {}),
        estimated_completion: kohde.valmistuu,
        field_sources: {
          housing_company: taloyhtio ? "lähde" : null,
          phase: "vaiheporras",
          location: kohde.osoite ? "lähde" : null,
          estimated_completion: "lähde",
          apartments: kohde.asuntoja ? "lähde" : null,
        },
      },
    })
  }

  return results
}
