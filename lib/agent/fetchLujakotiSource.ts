import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { housingCompanyName } from "@/lib/projects/housingCompanyKey"

/*
 * LUJAKOTI — RAKENNUTTAJAN OMA ASUNTOTUOTANTO.
 *
 * Lujatalolla on jo kaksi lähdettä (`lujatalo` = tiedotteet,
 * `lujatalo_projektit` = referenssit), mutta kumpikaan ei näe
 * OMAPERUSTEISIA asuntokohteita. Syy on rakenteellinen: omaperusteisesta
 * kohteesta ei synny urakkauutista, koska urakkaa ei kilpailuteta —
 * rakentaja rakentaa itselleen ja myy asunnot.
 *
 * Mitattu 6.9.2026: "Asunto Oy Tampereen Pioni" (Boijenkatu 6, 45
 * asuntoa) ei ollut kannassa lainkaan, vaikka saman korttelin
 * Boijenkatu 1, 2 ja 5 olivat. Ainoa maininta oli Rakennuslehden
 * maksumuurin takainen juttu, jonka näkyvästä osasta taloyhtiön nimi ei
 * selvinnyt ("Havainnekuva Tampereen Pionista" — ilman yhtiömuotoa).
 *
 * SIVUT OVAT RAKENTEISIA. Kohdesivulla on `data-title` ja
 * `data-address`, myyntitila sanana ja asuntomäärä tekstissä. Nimi on
 * rekisteröity taloyhtiö, eli juuri se tieto jota poimintasäännöt
 * joutuvat muualla arvaamaan (D-171).
 *
 * LISTAUSSIVUA EI OLE (`/kohteet/` = 404) eikä status-taksonomia
 * renderöidy palvelimella, joten kohteet luetaan sitemapista.
 * robots.txt sallii kaiken ja ilmoittaa sitemapin itse.
 */

const SITEMAP_URL = "https://lujakoti.fi/lujakoti_realty-sitemap.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/*
 * Myyntitila kertoo vaiheen suoraan, joten sitä ei tarvitse arvata.
 * "Muuttovalmis" tarkoittaa valmista rakennusta josta myydään vielä
 * asuntoja — rakentaminen on ohi, joten se ei ole hankelöytö.
 */
const TILAT: { kuvio: RegExp; vaihe: string | null }[] = [
  { kuvio: /muuttovalmis|valmistunut/i, vaihe: null },
  { kuvio: /rakenteilla|rakentaminen käynniss/i, vaihe: PHASE_LABELS.construction },
  { kuvio: /ennakkomarkkinoinnissa/i, vaihe: PHASE_LABELS.planning },
  { kuvio: /suunnitteilla|tulossa myyntiin/i, vaihe: PHASE_LABELS.planning },
  { kuvio: /myynniss/i, vaihe: PHASE_LABELS.construction },
]

export function vaiheMyyntitilasta(teksti: string | null | undefined): {
  vaihe: string | null
  tila: string | null
} {
  const t = String(teksti ?? "")
  for (const { kuvio, vaihe } of TILAT) {
    const osuma = t.match(kuvio)
    if (osuma) return { vaihe, tila: osuma[0] }
  }
  return { vaihe: null, tila: null }
}

/*
 * "45 asuntoa" -> 45.
 *
 * Väliin sallitaan vain lueteltu määresana ("51 UUTTA kotia"), ei mitä
 * tahansa sanaa: vapaa väli poimisi luvun väärästä yhteydestä, koska
 * samassa lauseessa on usein kerrosluku ja autopaikkamäärä.
 */
export function asuntomaaraTekstista(teksti: string | null | undefined): number | null {
  const m = String(teksti ?? "").match(
    /(\d{1,4})\s*(?:uutta|upeaa|modernia|tilavaa|uudenlaista\s+)?\s*(?:asunto(?:a|)|kotia)\b/i
  )
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n < 2000 ? n : null
}

/*
 * KAUPUNKI NIMESTÄ, EI OSOITTEESTA.
 *
 * Osoitekentässä lukee usein pelkkä katu ("Boijenkatu 6"), mutta
 * taloyhtiön nimessä kaupunki on aina genetiivissä: "Asunto Oy
 * TAMPEREEN Pioni". Osoite on silti varalla, koska osalla on siinä
 * postitoimipaikka ("Sammonkatu 26, 70500 Kuopio").
 */
export function kaupunkiKohteesta(nimi: string, osoite: string | null): string | null {
  return detectCityFromText(nimi) ?? (osoite ? detectCityFromText(osoite) : null)
}

/*
 * KENTÄT LUETAAN OMISTA ELEMENTEISTÄÄN, EI LEIPÄTEKSTISTÄ.
 *
 * Mitattu 6.9.2026: tekstistä luettuna "Asunto Oy Tampereen Pioni" sai
 * vaiheeksi Rakenteilla, koska markkinointiteksti sanoo "johon on
 * RAKENTEILLA yhteensä 45 asuntoa" — vaikka kohteen oma tilamerkintä on
 * "Ennakkomarkkinoinnissa" eikä rakentaminen ole alkanut. Sivun
 * `div.realty-meta` sisältää tilan omana kenttänään, ja osoite on
 * id:llä `#lujakoti-address`.
 *
 * Kuvaus otetaan `p`-elementeistä: `blockText` poimi `li`-alkiot, ja
 * sivun ylin lista on navigaatiovalikko ("Luja Lujatalo Lujabetoni
 * Fescon Etusivu...") joka päätyi jokaisen kohteen kuvaukseksi.
 */
export function parseLujakotiPage(html: string): {
  name: string
  address: string | null
  phase: string | null
  tila: string | null
  apartments: number | null
  description: string
} | null {
  const $ = cheerio.load(html)

  const name =
    ($("[data-title]").first().attr("data-title") ?? "").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim()

  if (!name) return null

  const address =
    $("#lujakoti-address").first().text().replace(/\s+/g, " ").trim() ||
    ($("[data-address]").first().attr("data-address") ?? "").trim() ||
    null

  /* Sirpaleet: osoite, myyntitila, tontin hallinta. */
  const sirpaleet = $(".realty-meta li")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t && !/^Tontti:/i.test(t) && t !== address)

  const { vaihe, tila } = vaiheMyyntitilasta(sirpaleet.join(" | "))

  const kappaleet = $(".vc-content p, .entry-content p, article p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 30)

  const description = kappaleet.join(" ").trim()

  return {
    name,
    address,
    phase: vaihe,
    tila,
    apartments: asuntomaaraTekstista(description),
    description: description.slice(0, 4000),
  }
}

async function haeSitemap(): Promise<string[]> {
  const response = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes("/kohteet/"))
}

export async function fetchLujakotiSource() {
  const urls = await haeSitemap()
  const results: any[] = []

  for (const url of urls) {
    let html: string
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA } })
      if (!response.ok) continue
      html = await response.text()
    } catch {
      continue
    }

    const sivu = parseLujakotiPage(html)
    if (!sivu) continue

    /* Valmis rakennus ei ole hankelöytö. */
    if (!sivu.phase) continue

    const city = kaupunkiKohteesta(sivu.name, sivu.address)

    /*
     * OTSIKKO EI AINA OLE TALOYHTIÖ. "Lujakoteja Koskelaan" on
     * markkinointiotsikko, ja oikea nimi lukee kuvauksessa ("Asunto Oy
     * Helsingin Koskelan Akseli on suunnitteilla..."). Poiminta on sama
     * kuin muillakin lähteillä (D-171), jottei markkinointilause päädy
     * taloyhtiön nimeksi.
     */
    const taloyhtio = housingCompanyName(sivu.name, sivu.description)

    /* Osoitteessa on usein jo postitoimipaikka: ei toisteta sitä. */
    const sijainti = sivu.address
      ? city && !new RegExp(city, "i").test(sivu.address)
        ? `${sivu.address}, ${city}`
        : sivu.address
      : null

    results.push({
      name: sivu.name,
      city,
      region: null,
      location: sijainti,
      phase: sivu.phase,
      description: sivu.description,
      /* Omaperusteinen: sama yhtiö rakentaa ja rakennuttaa. */
      builder: "Lujatalo",
      developer: "Lujatalo",
      property_type: "Kerrostalo",
      ...(sivu.apartments ? { apartments: sivu.apartments } : {}),
      source_url: url,
      confidence: 0.8,
      source_name: "lujakoti",
      metadata: {
        ...(taloyhtio
          ? { housing_company: taloyhtio, related_companies: [taloyhtio] }
          : {}),
        ...(sivu.tila ? { myyntitila: sivu.tila } : {}),
        field_sources: {
          housing_company: taloyhtio ? "lähde" : null,
          phase: "myyntitila",
          builder: "julkaisija",
          developer: "julkaisija",
          city: "nimi",
          location: sivu.address ? "lähde" : null,
        },
      },
    })
  }

  return results
}
