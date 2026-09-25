import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"
import { extractClientFromText, extractBuilderFromText } from "./fetchSttHakuSource"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { LEAD_LENGTH } from "./buildingType"

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
  /* WordPressin REST-päätepiste ilman sivutusparametreja. */
  endpoint: string
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

function tekstiksi(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| | /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#8221;|&#8220;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function luoTalotekniikkaLahde(yritys: TalotekniikkaYritys) {
  return async function fetchTalotekniikkaUutiset() {
    const tulokset: any[] = []

    for (let sivu = 1; sivu <= SIVUJA; sivu++) {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)

      let uutiset: any[] = []
      try {
        const vastaus = await fetch(
          `${yritys.endpoint}?per_page=${SIVUKOKO}&page=${sivu}&_fields=id,date,link,title,content`,
          {
            signal: ohjain.signal,
            cache: "no-store",
            headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
          }
        )
        if (!vastaus.ok) break
        uutiset = await vastaus.json()
      } catch {
        break
      } finally {
        clearTimeout(kello)
      }

      if (!Array.isArray(uutiset) || uutiset.length === 0) break

      for (const uutinen of uutiset) {
        const otsikko = tekstiksi(uutinen?.title?.rendered)
        const osoite = uutinen?.link
        if (!otsikko || !osoite) continue

        const teksti = tekstiksi(uutinen?.content?.rendered)
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

      if (uutiset.length < SIVUKOKO) break
    }

    return tulokset
  }
}
