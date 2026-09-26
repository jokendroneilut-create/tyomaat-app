import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"
import { extractClientFromText, extractBuilderFromText } from "./fetchSttHakuSource"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { LEAD_LENGTH } from "./buildingType"
import { extractReleaseBody } from "./companyRelease"

/*
 * TALOTEKNIIKKAURAKOITSIJAN OMAT UUTISET.
 *
 * Herätteenä Rakennuslehden juttu "Are sai viiden miljoonan
 * talotekniikkaurakan kouluhankkeesta" (23.9.2026). Sama tieto oli Aren
 * omalla sivulla **17.9.**, kuusi päivää aiemmin, ja huomattavasti
 * tarkempana:
 *
 *   Rakennuslehti  urakoitsija, urakkasumma
 *   are.fi         + kaupunki, rakennuttaja (Kokkolan kaupunki),
 *                    pääurakoitsija (Lujatalo Oy), laajuus 9 700 m2,
 *                    aikataulu syksy 2026 - kevät 2028
 *
 * TALOTEKNIIKKA ON OMA LÄHDELUOKKANSA. Pääurakoitsijoiden sivut ovat jo
 * lähteinä (Skanska, Hartela, Jatke...), mutta talotekniikkaurakoitsija
 * tiedottaa hankkeista joissa se on SIVU-urakoitsija - ja nimeää silloin
 * usein sekä rakennuttajan että pääurakoitsijan. Yksi tiedote antaa siis
 * kolme yritystä yhden sijaan.
 *
 * JULKAISIJA EI OLE PÄÄURAKOITSIJA. Se kirjataan `related_companies`-
 * listaan, ei `builder`-kenttään - sama ratkaisu kuin suunnittelijalla
 * (`companyRelease.ts`, role "designer"). Väärä rooli on pahempi kuin
 * puuttuva tieto, koska urakoitsijakenttää käytetään
 * kilpailija-analyysiin.
 */

export type TalotekniikkaYritys = {
  /* Yrityksen nimi sellaisena kuin se näytetään hankkeen yrityksissä. */
  nimi: string
  /*
   * WordPressin REST-päätepiste ilman sivutusparametreja, tai RSS-syötteen
   * osoite sellaisenaan.
   */
  endpoint: string
  /* Oletus on WordPress; kaikki eivät ole sitä (Sarlin on HubSpotissa). */
  tyyppi?: "wp" | "rss"
}

/*
 * HANKESIGNAALI. Talotekniikkayrityksen uutisvirta on enimmäkseen muuta
 * kuin hankkeita: rekrytointia, arvoja, sponsorointia, energiavinkkejä.
 * Mitattu Aren 342 uutisesta - hankeuutisia on noin joka viides.
 *
 * Verbit ovat toteutusverbejä ("toteuttaa", "vastaa", "toimittaa") eivätkä
 * yleisiä hankesanoja, koska "hanke" esiintyy myös kehitys- ja
 * vastuullisuusjutuissa.
 */
const HANKESIGNAALI = [
  "toteuttaa",
  "toteutuksessa",
  "toteuttamaan",
  "vastaa hankkeen",
  "vastaa ainutlaatuisen",
  "urakan",
  "urakka",
  "urakat",
  "urakoi",
  "kumppaniksi",
  "kumppanina",
  "valittiin",
  "valittu",
  "sai ",
  "voitti",
  "toimittaa",
  "asennustyöt",
  "talotekniikan",
  "talotekniikkaurak",
  "saneeraa",
  "peruskorjaa",
  /*
   * Sarlinin otsikkotyyli on eri kuin Aren: "Sarlin mukana RAKENTAMASSA
   * biokaasuratkaisua Nurmekseen" ja "Mäntsälän biovoiman
   * LAAJENNUSHANKE". Ilman näitä kahta lähde tuotti nolla kandidaattia
   * kymmenestä uutisesta, joista kaksi on hankkeita.
   *
   * Pelkkä "mukana" ei kelpaa: sillä osuisi myös "Olemme mukana vuoden
   * 2025 Ilmasto-ohjelmassa".
   */
  "rakentamassa",
  "laajennushank",
]

/*
 * POISSULKU. Sama rooli kuin Rakennuslehdellä: yksikin näistä pudottaa
 * rivin vaikka hankesignaali osuisi. Rekrytointi- ja
 * vastuullisuusjutuissa esiintyy jatkuvasti "toteuttaa" ja "valittu".
 */
const POISSULKU = [
  "rekry",
  "työharjoittelu",
  "harjoittelija",
  "kesätyö",
  "urapolku",
  "aloitti tehtävässä",
  "nimitys",
  "nimitetty",
  "toimitusjohtaja",
  "sponssi",
  "sponsoroi",
  "yhdenvertaisuus",
  "vastuullisuus",
  "osavuosikatsaus",
  "tilinpäätös",
  "liikevaihto",
  "yrityskaup",
  "blogi",
  "vinkkiä",
  "vinkit",
  "näin säästät",
  "energiakulut hallintaan",
  "asiakaspalvelussa",
  "webinaari",
  "messut",
  "podcast",
  "ostaa",
  "osakekann",
  "strategia",
  "arvioinnissa",
  "kultainen",
  "yhteisoon",
  "yhteisöön",
]

const VALMISTUNUT = [
  "valmistui",
  "valmistunut",
  "luovutettu",
  "otettu käyttöön",
  "vei maaliin",
  "saatiin päätökseen",
]

/* Kaksi sivua á 100 kattaa Arella noin kaksi vuotta. */
const SIVUJA = 2
const SIVUKOKO = 100

/* Sama katto kuin muilla lähteillä: rivi ei saa jumittaa lähdeajoa. */
const AIKAKATKAISU_MS = 15 * 1000

/*
 * MERKKIENTITEETIT PURETAAN ENNEN TAGIEN POISTOA (D-215).
 *
 * RSS-syotteen `content:encoded` sisaltaa HTML:n ESCAPATTUNA
 * (`&lt;div class=...&gt;`). Jos tagit poistetaan ensin, kuviossa ei ole
 * yhtaan `<`-merkkia eika mitaan poistu - ja kun entiteetit puretaan
 * vasta sen jalkeen, jaljelle jaa tagin sisus tekstina.
 *
 * Mitattu 26.9.2026: Sarlinin "Mantsalan biovoiman laajennushanke"
 * -rivin kuvaus oli 1 133 merkkia HubSpotin kuvakaareita ja
 * seurantapikselin osoitetta - ei sanaakaan hankkeesta.
 *
 * WordPress-haarassa vikaa ei nay, koska `content.rendered` on jo
 * purettua HTML:aa. Korjaus kuuluu silti tanne: sama funktio palvelee
 * molempia.
 *
 * Kaksi kierrosta, koska syotteissa on myos kahdesti koodattua
 * (`&amp;lt;`) sisaltoa.
 */
function puraEntiteetit(teksti: string): string {
  return teksti
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;|&#8221;|&#8220;|&#34;/g, '"')
    .replace(/&#0?39;|&#8217;|&apos;/g, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "–")
    .replace(/&amp;/gi, "&")
}

function tekstiksi(html: string | null | undefined): string {
  return puraEntiteetit(puraEntiteetit(String(html ?? "")))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[\u00a0\u202f\u200b]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* Yhteinen muoto kummallekin syötetyypille. */
type RaakaUutinen = { otsikko: string; osoite: string; teksti: string }

async function haeTeksti(osoite: string): Promise<string | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const vastaus = await fetch(osoite, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

async function haeWordPress(endpoint: string): Promise<RaakaUutinen[]> {
  const out: RaakaUutinen[] = []

  for (let sivu = 1; sivu <= SIVUJA; sivu++) {
    const teksti = await haeTeksti(
      `${endpoint}?per_page=${SIVUKOKO}&page=${sivu}&_fields=id,date,link,title,content`
    )
    if (!teksti) break

    let uutiset: any[] = []
    try {
      uutiset = JSON.parse(teksti)
    } catch {
      break
    }
    if (!Array.isArray(uutiset) || uutiset.length === 0) break

    for (const u of uutiset) {
      const otsikko = tekstiksi(u?.title?.rendered)
      const osoite = u?.link
      if (otsikko && osoite) {
        out.push({ otsikko, osoite, teksti: tekstiksi(u?.content?.rendered) })
      }
    }

    if (uutiset.length < SIVUKOKO) break
  }

  return out
}

/*
 * RSS-SYÖTE. Kaikki eivät ole WordPressiä: Sarlin on HubSpotissa, jonka
 * syöte antaa koko tekstin `content:encoded`-kentässä. Sama muunnos ja
 * samat suodattimet kuin WordPress-puolella - eroa on vain haussa.
 */
function osa(item: string, tagi: string): string | null {
  const osuma = item.match(
    new RegExp(`<${tagi}[^>]*>([\\s\\S]*?)<\\/${tagi}>`, "i")
  )
  if (!osuma) return null
  return tekstiksi(osuma[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, ""))
}

async function haeRss(endpoint: string): Promise<RaakaUutinen[]> {
  const xml = await haeTeksti(endpoint)
  if (!xml) return []

  const out: RaakaUutinen[] = []

  for (const item of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const otsikko = osa(item, "title")
    const osoite = osa(item, "link")
    if (!otsikko || !osoite) continue

    const teksti =
      osa(item, "content:encoded") ?? osa(item, "description") ?? ""

    out.push({ otsikko, osoite, teksti })
  }

  return out
}

export function luoTalotekniikkaLahde(yritys: TalotekniikkaYritys) {
  return async function fetchTalotekniikkaUutiset() {
    const tulokset: any[] = []

    const uutiset =
      yritys.tyyppi === "rss"
        ? await haeRss(yritys.endpoint)
        : await haeWordPress(yritys.endpoint)

    {
      for (const uutinen of uutiset) {
        const otsikko = uutinen.otsikko
        const osoite = uutinen.osoite

        const teksti = uutinen.teksti
        const haystack = `${otsikko} ${teksti}`.toLowerCase()

        /*
         * SIGNAALI VAADITAAN OTSIKOSTA, EI KOKO TEKSTISTA.
         *
         * Koko tekstista luettuna lapi menivat myos strategiajulkistukset,
         * yritysostot ja henkilojutut - niissa sanotaan ohimennen etta
         * yritys "toteuttaa" jotain. Mitattu 25.9.2026 Aren 200
         * uutisella: koko teksti 93 kandidaattia joista noin 40 %
         * kohinaa, pelkka otsikko 44 ja lahes kaikki hankkeita.
         */
        const otsikkoPieni = otsikko.toLowerCase()
        if (POISSULKU.some((k) => otsikkoPieni.includes(k))) continue
        if (!HANKESIGNAALI.some((k) => otsikkoPieni.includes(k))) continue

        const lead = teksti.slice(0, LEAD_LENGTH)

        /*
         * KAUPUNKI OTSIKOSTA TAI INGRESSISTA, EI KOKO TEKSTISTA.
         *
         * Tiedotteen loppuosassa mainitaan muita kohteita ja toimipisteita.
         * Mitattu: "ARE talotekniikkakumppaniksi uuteen hotellihankkeeseen
         * Kokkolassa" sai kaupungikseen Pietarsaaren ja "Uusi hybridiareena
         * nousee Kokkolaan" Kaustisen.
         */
        const city =
          detectCityFromText(otsikkoPieni) ?? detectCityFromText(lead.toLowerCase())

        /*
         * Tilaaja ja pääurakoitsija luetaan vain ingressistä, samasta
         * syystä kuin `companyRelease`: koko sivulta luettuna osapuoleksi
         * poimiutui naapuriartikkelin yritys.
         */
        const paaurakoitsija = extractBuilderFromText(otsikko, lead)
        const tilaaja = extractClientFromText(otsikko, lead)

        /*
         * Julkaisijaa ei kirjata osapuoleksi, eika paljasta kunnan
         * taivutusmuotoa: "Kokkolan" on jasennysvirhe, ei rakennuttajan
         * nimi. Perusmuotoa ei arvata - tyhja on parempi kuin vaara.
         */
        const kelpaa = (nimi: string | null) => {
          if (!nimi) return null
          if (nimi.toLowerCase() === yritys.nimi.toLowerCase()) return null
          if (!/\s/.test(nimi) && getMunicipalityByAnyForm(nimi)) return null
          return nimi
        }

        tulokset.push({
          name: otsikko,
          description: teksti || null,
          city,
          region: city ? getMunicipalityByName(city)?.region ?? null : null,
          location: null,
          developer: kelpaa(tilaaja),
          builder: kelpaa(paaurakoitsija),
          phase: VALMISTUNUT.some((k) => haystack.includes(k))
            ? "Valmistunut"
            : "Suunnittelussa",
          completed: VALMISTUNUT.some((k) => haystack.includes(k)),
          source_url: osoite,
          confidence: 0.5,
          source_name: yritys.nimi.toLowerCase().replace(/\s+/g, "_"),
          metadata: { related_companies: mergeCompanyNames([], [yritys.nimi]) },
        })
      }
    }

    return tulokset
  }
}

/*
 * RSS-SYÖTTEEN KUVAUS HAETAAN ARTIKKELISTA (D-215).
 *
 * WordPress antaa koko tekstin rajapinnassa, RSS ei aina anna mitään:
 * Sarlinin `description` on pelkkä HubSpotin kuvakääre ja seurantapikseli.
 * Siivouksen jälkeen kuvaus on siis tyhjä - oikein, mutta hyödytön.
 *
 * Artikkelisivulta sama juttu antaa 2 837 merkkiä, ja sen mukana
 * rakennuttajan ("Auris Energian enemmistöomistaman Mäntsälän Biovoiman")
 * ja hankkeen sisällön.
 *
 * Vain RSS-lähteille: WordPress-haarassa tämä olisi turha sivuhaku, ja
 * sivuhaku on juuri se kustannus jota tuontibudjetti rajoittaa.
 */
export function luoTalotekniikkaRikastus(yritys: TalotekniikkaYritys) {
  return async function enrichTalotekniikkaUutinen(candidate: any): Promise<any> {
    if (!candidate?.source_url) return candidate

    const html = await haeTeksti(candidate.source_url)
    if (!html) return candidate

    const body = tekstiksi(extractReleaseBody(html) ?? "")
    if (body.length <= String(candidate.description ?? "").length) return candidate

    const lead = body.slice(0, LEAD_LENGTH)
    const city =
      candidate.city ??
      detectCityFromText(String(candidate.name ?? "").toLowerCase()) ??
      detectCityFromText(lead.toLowerCase())

    const tilaaja = candidate.developer ?? extractClientFromText(candidate.name, lead)
    const kelpaa =
      tilaaja &&
      tilaaja.toLowerCase() !== yritys.nimi.toLowerCase() &&
      !(!/\s/.test(tilaaja) && getMunicipalityByAnyForm(tilaaja))

    return {
      ...candidate,
      description: body,
      city,
      region: city ? getMunicipalityByName(city)?.region ?? null : candidate.region,
      developer: kelpaa ? tilaaja : candidate.developer,
    }
  }
}
