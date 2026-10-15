import * as cheerio from "cheerio"

import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * FINGRIDIN KANTAVERKKOHANKKEET.
 *
 * MIKSI. Tämä on se aukko joka on ollut tiedossa pisimpään: yksityiset
 * ja valtakunnalliset suurhankkeet eivät osu Hilmaan, kunnan päätöksiin
 * eivätkä kaavoihin ([[private-developer-blind-spot]]). Kantaverkon
 * liityntä- ja voimajohtohankkeet ovat juuri niitä — ja ne ennakoivat
 * teollisuusinvestointeja, koska tehdas tarvitsee sähkön ennen seiniä.
 *
 * Fingrid nousi esiin myös lähdekartoituksessa 15.10.2026: se esiintyy
 * rakennuttajana 30 hankkeessamme ja rakentajana yhdessä, enemmän kuin
 * yksikään muu yritys jolla ei ollut lähdettä.
 *
 * MITÄ LÄHDE ANTAA. Mitattu 15.10.2026: listaussivulla 52 hanketta,
 * koko joukon haku 2,8 s. Jokaisella sivulla on nimetyt kentät
 * ("Hankkeen tyyppi", "Hankkeen tila", "Sijainti", "Pituus") ja
 * 2 135-32 123 merkin kuvaus.
 *
 * Tilajakauma: Suunnittelu 17, Rakentaminen 16, Ympäristöselvitys 11,
 * YVA-menettely 6, valmistunut 1. **50 / 52 on kesken** — toisin kuin
 * urakoitsijoiden referenssisivuilla, joissa valtaosa on historiaa.
 *
 * VAIHE TULEE LÄHTEESTÄ, EI ARVAUKSESTA. Fingrid kertoo sen itse, ja
 * se osuu suoraan omiin vaiheisiimme. Valmistuneita ei tuoda: valmis
 * voimajohto ei ole mahdollisuus (sama päätös kuin GRK ja NRC).
 */

const LISTAUS_URL = "https://www.fingrid.fi/kantaverkko/rakentaminen/hankkeet/"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const CONCURRENCY = 6

/* Kentät jotka sivulla on nimettyinä; tarvitaan myös arvon rajaamiseen. */
const KENTAT = [
  "Hankkeen tyyppi",
  "Hankkeen tila",
  "Hankkeen sijainti",
  "Sijainti",
  "Pituus",
  "Aikataulu",
  "Hankkeen tiedot",
]

export function hankeslugit(html: string): string[] {
  const osumat = [
    ...html.matchAll(/href="\/kantaverkko\/rakentaminen\/hankkeet\/([^"/]+)\//g),
  ].map((m) => m[1])

  return [...new Set(osumat)]
}

/*
 * Arvo luetaan seuraavaan nimettyyn kenttään asti. Lookahead-regex oli
 * tähän liian hauras: se palautti 51 tapauksessa 52:sta tyhjän, koska
 * kenttien välissä ei ole välimerkkiä vaan pelkkä välilyönti.
 */
export function lueKentta(teksti: string, nimi: string): string | null {
  const alku = teksti.indexOf(nimi + ":")
  if (alku < 0) return null

  const loppuun = teksti.slice(alku + nimi.length + 1)
  const seuraavat = KENTAT.map((o) => loppuun.indexOf(o + ":")).filter((i) => i > 0)
  const loppu = seuraavat.length ? Math.min(...seuraavat) : 120

  return loppuun.slice(0, loppu).trim().slice(0, 100) || null
}

/*
 * Fingridin oma tila -> meidän vaiheemme. YVA ja ympäristöselvitys ovat
 * hankkeen aikaisin julkinen vaihe, eli juuri se mitä asiakas haluaa
 * nähdä ennen kilpailutusta.
 */
export function vaiheTilasta(tila: string | null): string | null {
  const t = String(tila ?? "").toLowerCase()
  if (!t) return null
  if (t.includes("valmistunut")) return null
  if (t.includes("rakentaminen") || t.includes("toteutukse")) return PHASE_LABELS.construction
  if (t.includes("suunnittelu")) return PHASE_LABELS.planning
  if (t.includes("yva") || t.includes("ympäristö")) return PHASE_LABELS.idea
  /* Tuntematon tila ei ole valmistunut, joten se otetaan mukaan. */
  return PHASE_LABELS.planning
}

export function jasennaHankesivu(html: string): {
  otsikko: string
  teksti: string
  tyyppi: string | null
  tila: string | null
  sijainti: string | null
} | null {
  const $ = cheerio.load(html)
  $("script,style,noscript,nav,header,footer").remove()

  const otsikko = $("h1").first().text().replace(/\s+/g, " ").trim()
  if (!otsikko) return null

  /*
   * `.content-text` on artikkelin oma lohko. Koko `.content` sisältäisi
   * sivupalkin, jossa on kaikkien 52 hankkeen nimet — ne vuotaisivat
   * jokaisen hankkeen kuvaukseen.
   */
  const teksti = $(".content-text").first().text().replace(/\s+/g, " ").trim()
  if (!teksti) return null

  return {
    otsikko,
    teksti,
    tyyppi: lueKentta(teksti, "Hankkeen tyyppi"),
    tila: lueKentta(teksti, "Hankkeen tila"),
    sijainti: lueKentta(teksti, "Hankkeen sijainti") ?? lueKentta(teksti, "Sijainti"),
  }
}

async function haeHtml(url: string): Promise<string | null> {
  try {
    const vastaus = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  }
}

export async function fetchFingridProjectsSource() {
  const listaus = await haeHtml(LISTAUS_URL)
  if (!listaus) return []

  const jono = hankeslugit(listaus)
  const results: any[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jono.length) {
        const slug = jono.shift()
        if (!slug) break

        const url = `${LISTAUS_URL}${slug}/`
        const html = await haeHtml(url)
        if (!html) continue

        const sivu = jasennaHankesivu(html)
        if (!sivu) continue

        const vaihe = vaiheTilasta(sivu.tila)
        /* Valmistunut voimajohto ei ole mahdollisuus. */
        if (!vaihe) continue

        results.push({
          name: sivu.otsikko,
          /*
           * Sijainti on usein maakunta ("Lappi, Pohjois-Pohjanmaa") tai
           * jopa toinen maa, joten kaupunki varmistetaan kuntatunnistuksella.
           */
          city:
            detectCityFromText(sivu.sijainti ?? "") ??
            detectCityFromText(sivu.otsikko) ??
            detectCityFromText(sivu.teksti),
          region: null,
          location: null,
          phase: vaihe,
          description: sivu.teksti.slice(0, 4000),
          /* Kantaverkkoyhtiö on hankkeen tilaaja omilla sivuillaan. */
          developer: "Fingrid Oyj",
          builder: null,
          property_type: sivu.tyyppi ?? "Sähköverkko",
          source_url: url,
          confidence: 0.7,
          completed: false,
          source_name: "fingrid_hankkeet",
        })
      }
    })
  )

  return results
}
