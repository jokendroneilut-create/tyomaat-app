import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { paivaKuukaudesta } from "@/lib/projects/kuukausiPaiva"

/*
 * T2H:N KOHDESIVUT — RIKKAIN DATA, RAJATTU TAHTI.
 *
 * T2H rakentaa omaan lukuunsa ("Ihanat kodit"), joten sen kohteista ei
 * synny urakkauutista eikä hankintailmoitusta — sama katve kuin
 * Lujakodilla ja Laptilla (D-172, D-173). Mitattu 6.9.2026: 54
 * uniikista taloyhtiöstä vain 12 löytyi kannasta nimellä.
 *
 * KOHDESIVULLA ON schema.org/ApartmentComplex: nimi, katuosoite,
 * postinumero, kaupunki, KOORDINAATIT ja asuntojen määrä. Mikään muu
 * mitattu lähde ei anna koordinaatteja valmiina.
 *
 * ROBOTS.TXT ASETTAA `Crawl-delay: 15`, ja se on tämän kerääjän
 * määräävä rajoite: 62 sivua kertaajolla olisi 15,5 minuuttia, kun
 * lähteen aikakatto on 90 sekuntia. Siksi joka ajolla haetaan vain
 * muutama sivu ja lista kierretään ajan mukaan — koko luettelo tulee
 * käydyksi noin kahdessa viikossa, ja sen jälkeen kierros pitää tiedot
 * tuoreina.
 *
 * Kierrätys on tarkoituksella VUOROKAUDEN funktio eikä kantatilaa:
 * yksikään kerääjä ei lue kantaa, eikä sitä rajaa kannata rikkoa
 * yhden lähteen takia.
 */

const SITEMAP_URL = "https://www.t2h.fi/sitemap.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* robots.txt: Crawl-delay: 15. */
const VIIVE_MS = 15_000

/* Neljä sivua = 60 s viivettä, mikä mahtuu 90 sekunnin kattoon. */
const SIVUJA_PER_AJO = 4

/* Varmistus jos verkko takkuaa: ei jäädä odottamaan kattoon asti. */
const AIKABUDJETTI_MS = 75_000

const VUOROKAUSI_MS = 24 * 60 * 60 * 1000

/*
 * TILA LUETAAN LIPUSTA, EI LEIPÄTEKSTISTÄ.
 *
 * Sivulla on lyhyt tilalippu ("Tulossa"), jonka luokka on
 * Tailwind-soppaa eikä kelpaa valitsimeksi. Sen sijaan etsitään
 * elementti jonka KOKO teksti on tunnettu tilasana: leipätekstissä
 * esiintyvä "rakentamisen vaiheet" ei silloin osu, toisin kuin
 * vapaassa tekstihaussa (D-172:n ansa).
 */
const TILASANAT = [
  "tulossa",
  "ennakkomarkkinoinnissa",
  "ennakkomarkkinointi",
  "varattavissa",
  "myynnissä",
  "rakenteilla",
  "muuttovalmis",
  "valmis",
]

const VAIHEET: { kuvio: RegExp; vaihe: string | null }[] = [
  { kuvio: /^(muuttovalmis|valmis)$/i, vaihe: null },
  { kuvio: /^(rakenteilla|myynnissä)$/i, vaihe: PHASE_LABELS.construction },
  { kuvio: /^(tulossa|ennakkomarkkinoin\w*|varattavissa)$/i, vaihe: PHASE_LABELS.planning },
]

export function vaiheLipusta(tila: string | null | undefined): string | null {
  const t = String(tila ?? "").trim()
  for (const { kuvio, vaihe } of VAIHEET) {
    if (kuvio.test(t)) return vaihe
  }
  return null
}

export type T2hKohde = {
  nimi: string
  osoite: string | null
  kaupunki: string | null
  tila: string | null
  vaihe: string | null
  valmistuu: string | null
  asuntoja: number | null
  koordinaatit: { lat: number; lon: number } | null
  kuvaus: string
}

function jsonLdKohde(html: string): any | null {
  const lohkot = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]

  for (const lohko of lohkot) {
    let data: any
    try {
      data = JSON.parse(lohko[1])
    } catch {
      continue
    }

    const solmut = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data]
    const osuma = solmut.find((s: any) => s?.["@type"] === "ApartmentComplex")
    if (osuma) return osuma
  }

  return null
}

export function parseT2hPage(html: string): T2hKohde | null {
  const kohde = jsonLdKohde(html)
  const $ = cheerio.load(html)

  const nimi =
    (typeof kohde?.name === "string" ? kohde.name.trim() : "") ||
    $("h1").first().text().replace(/\s+/g, " ").trim()

  if (!nimi) return null

  /* Elementti jonka koko teksti on tilasana. */
  let tila: string | null = null
  $("div, span, p").each((_, el) => {
    if (tila) return
    const teksti = $(el).text().replace(/\s+/g, " ").trim()
    if (teksti.length <= 24 && TILASANAT.includes(teksti.toLowerCase())) tila = teksti
  })

  /* "Valmistuu: 10/2027" on oma rivinsä, ei leipätekstiä. */
  const valmistuuTeksti =
    $("*")
      .filter((_, el) => /^Valmistuu:\s*\d{1,2}\/20\d{2}$/.test($(el).text().replace(/\s+/g, " ").trim()))
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim() || null

  const osoiteOsat = kohde?.address
  const osoite =
    osoiteOsat?.streetAddress
      ? [osoiteOsat.streetAddress, osoiteOsat.postalCode, osoiteOsat.addressLocality]
          .filter(Boolean)
          .join(", ")
      : null

  const lat = Number(kohde?.geo?.latitude)
  const lon = Number(kohde?.geo?.longitude)

  const asuntoja = Number(kohde?.numberOfAccommodationUnits)

  return {
    nimi,
    osoite,
    kaupunki:
      (typeof osoiteOsat?.addressLocality === "string"
        ? detectCityFromText(osoiteOsat.addressLocality)
        : null) ?? detectCityFromText(nimi),
    tila,
    vaihe: vaiheLipusta(tila),
    valmistuu: paivaKuukaudesta(valmistuuTeksti),
    asuntoja: Number.isFinite(asuntoja) && asuntoja > 0 ? asuntoja : null,
    koordinaatit: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null,
    kuvaus: String(kohde?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 4000),
  }
}

/*
 * Kelpoisuus samalla säännöllä kuin Laptilla (D-173): tila kertoo ettei
 * kohde ole valmis, ja valmistumisaika todistaa että sivu on ajan
 * tasalla. Kumpikaan yksin ei riitä.
 */
export function onAjankohtainen(kohde: T2hKohde, nyt = new Date()): boolean {
  if (!kohde.vaihe) return false
  if (!kohde.valmistuu) return false
  return kohde.valmistuu >= nyt.toISOString().slice(0, 10)
}

/*
 * Kohdesivut ovat juuritasolla: `t2h.fi/asunto-oy-espoon-aurum`.
 * Asuntokohtaiset alasivut ("/2h-s-kt-4400-m2") jätetään pois.
 */
export function kohdeOsoitteet(xml: string): string[] {
  const kaikki = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())

  return [
    ...new Set(
      kaikki.filter((u) => /^https:\/\/www\.t2h\.fi\/(asunto|kiinteisto)-oy-[a-z0-9-]+\/?$/.test(u))
    ),
  ].sort()
}

/*
 * Vuorokauden mukaan kiertävä viipale. Sama päivä antaa saman viipaleen,
 * joten uudelleenajo ei hyppää yli mitään.
 */
export function ajonViipale<T>(kaikki: T[], nyt: number, koko = SIVUJA_PER_AJO): T[] {
  if (!kaikki.length) return []

  const alku = (Math.floor(nyt / VUOROKAUSI_MS) * koko) % kaikki.length
  const viipale: T[] = []

  for (let i = 0; i < Math.min(koko, kaikki.length); i++) {
    viipale.push(kaikki[(alku + i) % kaikki.length])
  }

  return viipale
}

export async function fetchT2hKohteetSource() {
  const aloitettu = Date.now()

  const vastaus = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!vastaus.ok) return []

  const urls = kohdeOsoitteet(await vastaus.text())
  const results: any[] = []

  for (const url of ajonViipale(urls, Date.now())) {
    /*
     * Budjettiin lasketaan TULEVA viive, ei vain kulunut aika. Ilman
     * sitä viimeinen kierros voisi alkaa 74 sekunnissa, odottaa 15 ja
     * hakea vielä sivun — eli ylittää lähteen 90 sekunnin katon.
     */
    if (Date.now() - aloitettu + VIIVE_MS > AIKABUDJETTI_MS) break

    /* Crawl-delay myös ensimmäiseen: sitemap haettiin juuri. */
    await new Promise((r) => setTimeout(r, VIIVE_MS))

    let html: string
    try {
      const sivu = await fetch(url, { headers: { "User-Agent": UA } })
      if (!sivu.ok) continue
      html = await sivu.text()
    } catch {
      continue
    }

    const kohde = parseT2hPage(html)
    if (!kohde || !onAjankohtainen(kohde)) continue

    results.push({
      name: kohde.nimi,
      city: kohde.kaupunki,
      region: null,
      location: kohde.osoite,
      phase: kohde.vaihe,
      description: kohde.kuvaus,
      /* Omaperusteinen: sama yhtiö rakentaa ja rakennuttaa. */
      builder: "T2H",
      developer: "T2H",
      estimated_completion: kohde.valmistuu,
      source_url: url,
      confidence: 0.8,
      source_name: "t2h_kohteet",
      metadata: {
        /* Otsikko ON rekisteröity taloyhtiö (JSON-LD:n `name`). */
        housing_company: kohde.nimi,
        related_companies: [kohde.nimi],
        ...(kohde.asuntoja ? { apartments: kohde.asuntoja } : {}),
        ...(kohde.koordinaatit ? { koordinaatit: kohde.koordinaatit } : {}),
        ...(kohde.tila ? { myyntitila: kohde.tila } : {}),
        estimated_completion: kohde.valmistuu,
        field_sources: {
          housing_company: "lähde",
          phase: "tilalippu",
          location: kohde.osoite ? "lähde" : null,
          estimated_completion: "lähde",
          apartments: kohde.asuntoja ? "lähde" : null,
        },
      },
    })
  }

  return results
}
