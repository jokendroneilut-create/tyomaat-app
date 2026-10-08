import * as cheerio from "cheerio"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { paivaKuukaudesta } from "@/lib/projects/kuukausiPaiva"

/*
 * HEKA: AJANKOHTAISET UUDISKOHTEEMME (D-251).
 *
 * Helsingin kaupungin asunnot Oy (Heka) on kaupungin vuokrataloyhtio,
 * kuten Espoon Asunnot Espoossa. Sivu listaa rakenteilla olevat
 * uudiskohteet yhtena luettelona: osoite, kaupunginosa, asuntomaara ja
 * TARKKA arvioitu valmistumispaiva. Mikaan nykyinen lahteemme ei anna
 * paivaa: Vuosaarentie 3:n arvio kannassa (Skanskan tiedotteesta) on
 * kuukauden tarkkuudella 2027-11-30, Hekan sivulla 26.11.2027.
 *
 * MITATTU 8.10.2026: 8 kohdetta, 676 asuntoa, kaikki valmistuvat 2027.
 * Kannassa olivat Tihtaalinkatu 4 ja Vuosaarentie 3 (Skanskan
 * tiedotteista); kuusi puuttui. Koirasaarentie 10 lisattiin samana
 * paivana kasin.
 *
 * TAPA: HTML-sivu. WordPress-sivusto, mutta REST-rajapinta vaatii
 * kirjautumisen (`/wp-json/` ja `/wp-json/wp/v2/pages/12626` -> 401).
 * robots.txt:ta ei ole (404), joten mitaan ei ole kielletty. Yksi
 * sivunhaku per ajo.
 */

export const HEKA_SIVU = "https://www.hekaoy.fi/kohteet/ajankohtaiset-uudiskohteemme/"
export const HEKA = "Helsingin kaupungin asunnot Oy (Heka)"

const OTSAKKEET = { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" }

export type HekaKohde = {
  osoite: string
  kaupunginosa: string | null
  asuntoja: number | null
  valmistuu: string | null
  /* Muut rivin palat sellaisenaan, esim. "seniorikohde". */
  lisatiedot: string[]
  /* Lahin edeltava valiotsikko, esim. "Vuonna 2027 valmistuvat uudiskohteet". */
  osio: string
  rivi: string
  valmis: boolean
}

/*
 * "Paletinkierto 7", "Kiribatinkatu 1", myos "Tie 3 A" ja "Katu 5-7".
 * Rivin ensimmaisen palan on oltava tallainen; muuten rivi ei ole kohde.
 */
const OSOITE = /^[\p{Lu}][\p{L}-]*(?:\s[\p{L}-]+)*\s\d+(?:\s?[A-Za-z])?(?:\s?[-–]\s?\d+)?$/u

/* "arvioitu valmistumisaika 31.5.2027" — tarkka paiva. */
const VALMISTUMISPAIVA = /valmistu\p{L}*\s+(\d{1,2})\.(\d{1,2})\.(20\d{2})/u

/*
 * VALMISTUNUT VAATII VAHVAN TODISTEEN ([[hiding-threshold]]).
 *
 * Heka listaa vain rakenteilla olevia, eika 8.10.2026 sivulla ollut
 * yhtaan valmistunutta. Jos sivu joskus kertoo valmistumisesta, se
 * tehdaan joko valiotsikolla ("Vuonna 2026 valmistuneet uudiskohteet")
 * tai rivin sanalla ("valmistui 31.5.2027"). Nama merkitaan heti.
 *
 * EI merkita valmiiksi pelkasta menneesta arviopaivasta: arvio voi
 * venya, ja kesken oleva hanke piilotettuna on pahempi kuin valmistunut
 * listalla. "Valmistuvat" ja "valmistumisaika" eivat osu, koska sanan on
 * paatyttava kuvioon.
 */
const VALMIS = /(?:^|[^\p{L}])(?:valmistu(?:nut|neet|neita|i)|valmis|valmiit|luovutettu|luovutetut)(?![\p{L}])/iu

/* Jasennys erillaan hausta, jotta sen voi testata tallennetulla sivulla. */
export function jasennaHekaSivu(html: string): HekaKohde[] {
  const $ = cheerio.load(html)
  /*
   * Haku rajataan sisaltoon: sivupalkissa on <li>-linkkeja ("Tutustu
   * kohteisiimme"), jotka eivat ole kohteita.
   */
  const sisalto = $(".content__body").first().length ? $(".content__body").first() : $("main").first()
  const out: HekaKohde[] = []

  let osio = ""
  sisalto.find("h2, h3, li").each((_, el) => {
    const teksti = $(el).text().replace(/\s+/g, " ").trim()
    if ($(el).is("h2, h3")) {
      osio = teksti
      return
    }

    const palat = teksti.split(",").map((p) => p.trim()).filter(Boolean)
    const osoite = palat[0] ?? ""
    if (!OSOITE.test(osoite)) return

    const asuntoMatch = teksti.match(/(\d{1,4})\s*(?:asuntoa|asunnon|asuntoja|asunto)(?![\p{L}])/u)
    const paivaMatch = teksti.match(VALMISTUMISPAIVA)
    /* Kohde vaatii joko asuntomaaran tai valmistumisajan: pelkka osoite voi olla mita vain. */
    if (!asuntoMatch && !/valmistu/i.test(teksti)) return

    const valmistuu = paivaMatch
      ? `${paivaMatch[3]}-${paivaMatch[2].padStart(2, "0")}-${paivaMatch[1].padStart(2, "0")}`
      : /valmistu/i.test(teksti)
        ? paivaKuukaudesta(teksti)
        : null

    /* Toinen pala on kaupunginosa, jos se ei ole maara tai aikataulu. */
    const toinen = palat[1] ?? ""
    const kaupunginosa = toinen && !/\d|asunto|valmistu/i.test(toinen) ? toinen : null

    const lisatiedot = palat
      .slice(kaupunginosa ? 2 : 1)
      .filter((p) => !/\d+\s*asunto|valmistu/i.test(p))

    out.push({
      osoite,
      kaupunginosa,
      asuntoja: asuntoMatch ? Number(asuntoMatch[1]) : null,
      valmistuu,
      lisatiedot,
      osio,
      rivi: teksti,
      valmis: VALMIS.test(teksti) || VALMIS.test(osio),
    })
  })

  return out
}

/*
 * PYSYVA source_url ILMAN KOHDESIVUA.
 *
 * Sivulla ei ole kohdekohtaisia linkkeja, ja kaikki kahdeksan kohdetta
 * ovat samalla sivulla. Pelkka sivun osoite antaisi kaikille saman
 * source_url:n, jolloin ne tulkittaisiin yhdeksi lahdedokumentiksi.
 * Siksi osoitteeseen lisataan katuosoitteesta johdettu fragmentti
 * (`#paletinkierto-7`), samoin kuin kaavalistoissa (`#kaavatunnus`).
 *
 * Katuosoite on kohteen pysyva tunniste sivulla: se ei muutu kun kohde
 * siirtyy valiotsikosta toiseen (esim. rakenteilla -> valmistuneet), joten
 * sama hanke paivittyy eika synny uutena. Fragmentti ei mene palvelimelle,
 * joten linkki avaa oikean sivun.
 */
export function osoiteAnkkuri(osoite: string): string {
  return osoite
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function hekaEhdokas(kohde: HekaKohde) {
  const city = "Helsinki"
  const phase = kohde.valmis ? PHASE_LABELS.completed : PHASE_LABELS.construction
  const nimi = kohde.kaupunginosa
    ? `Heka ${kohde.kaupunginosa}, ${kohde.osoite}`
    : `Heka ${kohde.osoite}`

  /*
   * Kuvaus on sivun oma rivi sellaisenaan valiotsikon kanssa; mitaan ei
   * keksita lisaa. Rivi on lyhyt, mutta kaikki siina on dataa.
   */
  const description = `${HEKA}, uudiskohde. ${kohde.osio ? `${kohde.osio}: ` : ""}${kohde.rivi}.`

  return {
    name: nimi,
    description,
    city,
    region: getMunicipalityByName(city)?.region ?? null,
    location: kohde.osoite,
    /* Paaurakoitsijaa sivu ei kerro; se tulee urakkatiedotteista (Skanska). */
    developer: HEKA,
    phase,
    ...(kohde.valmis ? { completed: true } : {}),
    /*
     * Kerrostalo kaikille: Heka rakentaa vuokrakerrostaloja.
     * "Seniorikohde" (Maunulantie 20) on tavallinen vuokrakerrostalo
     * ikaantyneille, ei hoivakoti, joten se kirjataan metadataan eika
     * tyypiksi.
     */
    property_type: "Kerrostalo",
    estimated_completion: kohde.valmistuu,
    source_url: `${HEKA_SIVU}#${osoiteAnkkuri(kohde.osoite)}`,
    confidence: 0.8,
    source_name: "heka",
    metadata: {
      ...(kohde.asuntoja ? { apartments: kohde.asuntoja } : {}),
      ...(kohde.kaupunginosa ? { kaupunginosa: kohde.kaupunginosa } : {}),
      ...(kohde.lisatiedot.length ? { lisatiedot: kohde.lisatiedot } : {}),
      hallintamuoto: "vuokra",
      estimated_completion: kohde.valmistuu,
      field_sources: {
        phase: kohde.valmis ? "lähde: valmistunut" : "lähde: uudiskohdeluettelo",
        location: "lähde",
        estimated_completion: kohde.valmistuu ? "lähde" : null,
        apartments: kohde.asuntoja ? "lähde" : null,
      },
    },
  }
}

export async function fetchHekaSource() {
  let html: string
  try {
    const res = await fetch(HEKA_SIVU, { headers: OTSAKKEET, cache: "no-store" })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  return yksiPerOsoite(jasennaHekaSivu(html)).map(hekaEhdokas)
}

/*
 * Sama osoite kahdesti (esim. kahden valiotsikon alla) -> yksi ehdokas,
 * koska source_url on osoitteen funktio. Valmistunut-rivi voittaa: se on
 * vahvempi todiste kuin rakenteilla-luettelo, joka voi jaada paivittamatta.
 */
export function yksiPerOsoite(kohteet: HekaKohde[]): HekaKohde[] {
  const out = new Map<string, HekaKohde>()
  for (const k of kohteet) {
    const avain = osoiteAnkkuri(k.osoite)
    const aiempi = out.get(avain)
    if (!aiempi || (k.valmis && !aiempi.valmis)) out.set(avain, k)
  }
  return [...out.values()]
}
