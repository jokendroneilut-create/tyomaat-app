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

/*
 * SIVUN ALUN VAKIOTEKSTI. Selainkehotus ja pikavalikko toistuvat joka
 * sivulla eivätkä kerro hankkeesta mitään.
 *
 * Aiempi versio ajoi trim():n VASTA poiston jälkeen, jolloin `^Ole hyvä`
 * ei osunut koskaan — rivin alussa oli välilyönti. Mitattu 21.8.2026:
 * 15 ehdokasta 15:stä alkoi selainkehotuksella.
 */
const BOILERPLATE = [
  /^Ole hyvä ja päivitä selaimesi[^.]*\.\s*/i,
  /^Pikavalikko\s*/i,
  /^(palvelut ja liikenneyhteydet|tulevat kodit|sijainti|kuvia alueelta|jätä yhteystiedot)\s*/i,
]

/*
 * Nämä eivät ole aina tekstin alussa: osalla sivuista otsikko tulee ensin
 * ja pikavalikko vasta sen jälkeen, jolloin ^-ankkuroitu poisto ei osu.
 * Mitattu 21.8.2026: Turun ja Nokian kuvaus alkoi silti navigaatiolla tai
 * yhteydenottokehotuksella. Poistetaan siksi mistä tahansa kohdasta.
 *
 * Merkkijonot ovat sivuston omia vakiotekstejä eivätkä voi esiintyä
 * hankekuvauksessa, joten poisto on turvallinen.
 */
const BOILERPLATE_ANYWHERE = [
  /Pikavalikko\s*/gi,
  /\b(palvelut ja liikenneyhteydet|tulevat kodit|kuvia alueelta|jätä yhteystiedot)\b\s*/gi,
  /Haluatko kuulla lisää(\s+ensimmäisten joukossa)?\?\s*Jätä yhteystietosi!\s*/gi,
]

/*
 * HANKEOSUUS SIVUN TEKSTISTÄ.
 *
 * Sivun alkuosa markkinoi KAUPUNKIA, ei hanketta: "Nokia tarjoaa kattavan
 * palveluverkoston. Päiväkodit, koulut, lukio…". Sieltä luettuna kuvaus on
 * hyödytön ja rakennustyyppi suorastaan väärä — mitattu 21.8.2026:
 * 6 ehdokasta 15:stä sai tyypikseen Päiväkoti, Koulu tai Liikuntapaikka,
 * vaikka sivusto on nimeltään "tulevat asuinalueet".
 *
 * Hankeosuus alkaa käytännössä aina verbistä joka kertoo suunnittelusta,
 * ja siinä on myös osoite ("Suunnittelemme uusia koteja … osoitteeseen
 * Airikintie 5"). Poimitaan siitä eteenpäin.
 */
const PROJECT_VERB =
  /(suunnitteilla|suunnittelemme|suunnittelemassa|rakentuu|rakennamme|täydentyy|valmistuu)/i

/*
 * Pelkkä verbi ei riitä: "arki rakentuu lähellä olevien palveluiden
 * ympärille" on kaupungin markkinointia. Vaaditaan samaan virkkeeseen
 * myös asumiseen viittaava sana, jolloin osuma on hanke eikä tunnelmointi.
 */
const HOUSING_WORD = /kodi|koti|kortteli|kerrostalo|rivitalo|asunto|asuin|taloa|talot/i

/*
 * VAIN ASUINTYYPPI KELPAA. Sivusto on "tulevat asuinalueet", joten
 * päiväkoti tai koulu on aina väärinluettu — se tulee kaupungin
 * palveluita luettelevasta markkinointitekstistä. Kuvauksen rajaus
 * hankeosuuteen poistaa suurimman osan näistä, mutta portti on halpa ja
 * estää loputkin: tyhjä tyyppi on parempi kuin väärä.
 */
const RESIDENTIAL = /asuin|kerrostalo|rivitalo|paritalo|omakoti|luhtitalo|asunto/i

export function residentialTypeOnly(type: string | null | undefined): string | null {
  if (!type) return null
  return RESIDENTIAL.test(type) ? type : null
}

export function hartelaCleanText(bodyText: string | null | undefined): string {
  let text = String(bodyText ?? "").replace(/\s+/g, " ").trim()

  for (const re of BOILERPLATE_ANYWHERE) {
    text = text.replace(re, " ")
  }
  text = text.replace(/\s+/g, " ").trim()

  /* Jokainen vakiolohko voi esiintyä useasti peräkkäin. */
  let muuttui = true
  while (muuttui) {
    muuttui = false
    for (const re of BOILERPLATE) {
      const lyhyempi = text.replace(re, "").trim()
      if (lyhyempi !== text) {
        text = lyhyempi
        muuttui = true
      }
    }
  }

  return text
}

/*
 * Virkkeen alusta, jottei lause katkea kesken — mutta korkeintaan 200
 * merkkiä taaksepäin. Sivulla on kohtia joissa koko kappale on yhtä
 * virkettä ja alussa on kuvatekstejä ("jätä yhteystiedot Luonnoskuva");
 * ilman rajaa ne tulisivat mukaan.
 */
const MAX_LOOKBACK = 200

export function hartelaDescription(bodyText: string | null | undefined): string {
  const text = hartelaCleanText(bodyText)

  const virkkeet = text.split(/(?<=\.)\s+/)
  let kohta = 0

  for (const virke of virkkeet) {
    if (PROJECT_VERB.test(virke) && HOUSING_WORD.test(virke)) {
      const verbi = virke.match(PROJECT_VERB)
      const alkuVirkkeessa = verbi?.index ?? 0
      /* Pitkän virkkeen alkupää voi olla kuvatekstiä — aloita verbistä. */
      const siirto = alkuVirkkeessa > MAX_LOOKBACK ? alkuVirkkeessa : 0
      return text.slice(kohta + siirto).slice(0, 4000)
    }
    kohta += virke.length + 1
  }

  return text.slice(0, 4000)
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

          const bodyText = p("body").text()

          const description = hartelaDescription(bodyText)

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
            /*
             * Tyyppi paatellaan RAJATUSTA hankeosuudesta, ei koko sivusta.
             * Mitattu 21.8.2026: koko tekstista paattely osuu ensin
             * kaupungin palveluluetteloon ("Paivakodit, koulut, lukio"),
             * jolloin portti nollaa tuloksen ja tyyppi jaa tyhjaksi
             * neljalta hankkeelta jotka rajauksesta saavat oikean.
             */
            property_type: residentialTypeOnly(inferBuildingType(name, description)),
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
