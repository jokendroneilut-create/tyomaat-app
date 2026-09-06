import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { viimeinenPaiva } from "@/lib/projects/kuukausiPaiva"

/*
 * BONAVAN KOHDESIVUT — OMAPERUSTEINEN ASUNTOTUOTANTO.
 *
 * Lähde `bonava` lukee mediatiedotteet (`/tietoa-meista/media`). Omat
 * asuntokohteet eivät näy siellä: urakkaa ei kilpailuteta, koska Bonava
 * rakentaa itselleen ja myy asunnot (sama katve kuin D-172).
 *
 * MYYNTITILA ON KONELUETTAVA. Sivu asettaa `window.bonavaInfo`-oliot,
 * joissa on `pageType` ja `salesStatus`. Mitattu 6.9.2026: 423
 * `/asunnot/`-osoitteesta 33 on kohdesyvyydellä ja niistä 13 on
 * `ProjectPage`. Tilajakauma oli 5 Planned, 3 ForSale, 3 Presales ja 2
 * ReadyToMoveIn — eli 11 kesken, ja viisi vasta suunnitteilla. Se on
 * aikaisin vaihe mitä yksikään mitattu rakentajasivusto merkitsee.
 *
 * robots.txt sallii nämä polut (kieltää vain /episerver, /home-data,
 * /mypageslogin ja /Sources/Images/Pois/) ja ilmoittaa sitemapin.
 */

const SITEMAP_URL = "https://www.bonava.fi/sitemap.xml"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/*
 * Bonavan oma myyntiportaikko. "ReadyToMoveIn" tarkoittaa valmista
 * rakennusta josta myydään vielä asuntoja — rakentaminen on ohi.
 */
const TILAT: Record<string, string | null> = {
  planned: PHASE_LABELS.planning,
  presales: PHASE_LABELS.planning,
  forsale: PHASE_LABELS.construction,
  underconstruction: PHASE_LABELS.construction,
  readytomovein: null,
  sold: null,
}

export function vaiheMyyntitilasta(tila: string | null | undefined): string | null {
  const avain = String(tila ?? "").toLowerCase().replace(/[^a-z]/g, "")
  return avain in TILAT ? TILAT[avain] : null
}

const KUUKAUDET = [
  "tammikuu",
  "helmikuu",
  "maaliskuu",
  "huhtikuu",
  "toukokuu",
  "kesäkuu",
  "heinäkuu",
  "elokuu",
  "syyskuu",
  "lokakuu",
  "marraskuu",
  "joulukuu",
]

/*
 * "Lokakuu 2026" -> "2026-10-31". Kuukauden viimeinen päivä, koska
 * lähde antaa kuukauden tarkkuuden.
 *
 * Vuodenaikoja ("Syksy 2026") EI tulkita: ne osuisivat useaan
 * kuukauteen ja arvaus näyttäisi tarkalta tiedolta.
 */
export function valmistumispaiva(arvo: string | null | undefined): string | null {
  const teksti = String(arvo ?? "").toLowerCase()

  const vuosi = teksti.match(/\b(20\d{2})\b/)
  if (!vuosi) return null

  const kuukausi = KUUKAUDET.findIndex((k) => teksti.includes(k))
  if (kuukausi < 0) return `${vuosi[1]}-12-31`

  return viimeinenPaiva(Number(vuosi[1]), kuukausi + 1)
}

/*
 * TALOYHTIÖ TÄSMÄHAULLA, EI POIMINTASÄÄNNÖLLÄ.
 *
 * Kaksi syytä olla käyttämättä `housingCompanyName`ia tässä:
 *
 * 1. Se lukee vain otsikon ja kuvauksen kaksi ensimmäistä virkettä
 *    (D-152). Bonavan sivulla yhtiö mainitaan vasta kuvauksen
 *    puolivälissä — mitattu 6.9.2026: merkki 600 / 8 134.
 * 2. Sen genetiivikatkaisu pudottaisi lopun numeron ("Asunto Oy Espoon
 *    Tuulikello 3" -> "…Tuulikello"), ja Tuulikello 2 ja 3 ovat ERI
 *    taloyhtiöitä. Väärin yhdistetty pari olisi pahempi kuin puuttuva
 *    nimi.
 *
 * Sivun oma `productName` on tarkka, joten yhtiö kelpaa vain jos teksti
 * sisältää täsmälleen "<yhtiömuoto> <productName>". Ei arvausta.
 */
const YHTIOMUODOT = ["Asunto Oy", "As. Oy", "As Oy", "Kiinteistö Oy", "Koy"]

export function taloyhtioNimesta(productName: string, teksti: string): string | null {
  const nimi = String(productName ?? "").trim()
  if (!nimi) return null

  for (const muoto of YHTIOMUODOT) {
    const ehdokas = `${muoto} ${nimi}`
    if (String(teksti ?? "").includes(ehdokas)) return ehdokas
  }
  return null
}

/* /asunnot/espoo/tapiola/tuulikello/espoon-tuulikello-3 -> "espoo". */
export function kaupunkiOsoitteesta(url: string): string | null {
  const osat = url.split("/").filter(Boolean)
  const i = osat.indexOf("asunnot")
  const pala = i >= 0 ? osat[i + 1] : null
  return pala ? detectCityFromText(pala) : null
}

function bonavaKentta(html: string, nimi: string): string | null {
  const m = html.match(new RegExp(`window\\.bonavaInfo\\.${nimi} = '([^']*)'`))
  return m?.[1]?.trim() || null
}

export type BonavaKohde = {
  nimi: string
  osoite: string | null
  tila: string | null
  vaihe: string | null
  valmistuu: string | null
  valmistuuTeksti: string | null
  kuvaus: string
}

export function parseBonavaPage(html: string): BonavaKohde | null {
  if (bonavaKentta(html, "pageType") !== "ProjectPage") return null

  const nimi = bonavaKentta(html, "productName")
  if (!nimi) return null

  const $ = cheerio.load(html)

  /* Hero-laatikon kenttäparit: otsikko + arvo. */
  const kentat = new Map<string, string>()
  $(".hero-box-fact").each((_, el) => {
    const otsikko = $(el).find(".hero-box-fact__title").text().replace(/[\s:]+$/, "").trim()
    const arvo = $(el).find(".hero-box-fact__value").text().replace(/\s+/g, " ").trim()
    if (otsikko && arvo) kentat.set(otsikko.toLowerCase(), arvo)
  })

  const osoite =
    $(".showings__information__details--address").first().text().replace(/\s+/g, " ").trim() || null

  const kuvaus = $("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 40)
    .join(" ")
    .slice(0, 4000)

  const tila = bonavaKentta(html, "salesStatus")

  return {
    nimi,
    osoite,
    tila,
    vaihe: vaiheMyyntitilasta(tila),
    valmistuu: valmistumispaiva(kentat.get("valmistuminen")),
    valmistuuTeksti: kentat.get("valmistuminen") ?? null,
    kuvaus,
  }
}

/*
 * Kohdesivut ovat syvyydellä /asunnot/<kaupunki>/<alue>/<kohde>[/<vaihe>].
 * Karkea rajaus riittää, koska `pageType` tarkistetaan silti sivulta:
 * väärä arvaus maksaa yhden turhan pyynnön, ei väärää hanketta.
 */
function kohdeOsoitteet(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes("/asunnot/"))
    .filter((u) => u.split("/").length - 3 === 5)
}

export async function fetchBonavaKohteetSource() {
  const response = await fetch(SITEMAP_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const urls = kohdeOsoitteet(await response.text())
  const results: any[] = []
  const nahdyt = new Set<string>()

  for (const url of urls) {
    let html: string
    try {
      const sivu = await fetch(url, { headers: { "User-Agent": UA } })
      if (!sivu.ok) continue
      html = await sivu.text()
    } catch {
      continue
    }

    const kohde = parseBonavaPage(html)
    if (!kohde?.vaihe) continue

    const taloyhtio = taloyhtioNimesta(kohde.nimi, kohde.kuvaus)

    /*
     * TARKKA NIMI, EI AVAIN. Sama kortteli on sitemapissa useana
     * sivuna, mutta `housingCompanyKey` pudottaa lopun numeron
     * ("…Tuulikello 3" -> "espoon tuulikell"), jolloin Tuulikello 2 ja
     * 3 näyttäisivät samalta yhtiöltä. Ne ovat eri taloyhtiöitä ja eri
     * hankkeita, joten avaimella karsiminen hukkaisi toisen.
     */
    const avain = (taloyhtio ?? kohde.nimi).toLowerCase().replace(/\s+/g, " ").trim()
    if (nahdyt.has(avain)) continue
    nahdyt.add(avain)

    results.push({
      name: taloyhtio ?? kohde.nimi,
      city: kaupunkiOsoitteesta(url) ?? detectCityFromText(kohde.nimi),
      region: null,
      location: kohde.osoite,
      phase: kohde.vaihe,
      description: kohde.kuvaus,
      builder: "Bonava",
      developer: "Bonava",
      property_type: null,
      ...(kohde.valmistuu ? { estimated_completion: kohde.valmistuu } : {}),
      source_url: url,
      confidence: 0.8,
      source_name: "bonava_kohteet",
      metadata: {
        ...(taloyhtio ? { housing_company: taloyhtio, related_companies: [taloyhtio] } : {}),
        ...(kohde.valmistuu ? { estimated_completion: kohde.valmistuu } : {}),
        ...(kohde.tila ? { myyntitila: kohde.tila } : {}),
        ...(kohde.valmistuuTeksti ? { valmistumisteksti: kohde.valmistuuTeksti } : {}),
        field_sources: {
          housing_company: taloyhtio ? "teksti" : null,
          phase: "salesStatus",
          location: kohde.osoite ? "lähde" : null,
          estimated_completion: kohde.valmistuu ? "lähde" : null,
          city: "osoitepolku",
        },
      },
    })
  }

  return results
}
