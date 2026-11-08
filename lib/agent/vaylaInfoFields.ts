import * as cheerio from "cheerio"

import { companies } from "@/lib/agent/knowledge/companies"

/*
 * VÄYLÄVIRASTON HANKESIVUN KENTTÄLOHKO (D-377).
 *
 * Johannes 7.11.2026 avattuaan Kirjalansalmen lähteen: *"kreate puuttuu
 * sekä kustannusarvio."* Sivulla ne lukevat omassa lohkossaan:
 *
 *     <div class="project__info__additional">
 *       <div class="project__info__additional__item">
 *         <strong> Urakoitsija </strong><br> Kreate Oy
 *       </div>
 *       <div class="project__info__additional__item">
 *         <strong> Kustannukset </strong><br> 128 miljoonaa euroa
 *       </div>
 *       <div class="project__info__additional__item">
 *         <strong> Tilaaja </strong><br>Väylävirasto
 *       </div>
 *     </div>
 *
 * `fetchVaylaProjectDetails` poimi sivulta yhteystiedon, edistymisen ja
 * kuvauksen muttei tätä lohkoa lainkaan.
 *
 * LOHKO ON HARVINAINEN. Mitattu 7.11.2026 tasavälisellä 24 sivun
 * otoksella kannan 272 vayla.fi-osoitteesta: lohko löytyi **2 sivulta**.
 * Se on isojen nimettyjen hankkeiden sivuilla; tavallisilla
 * tieparannussivuilla ei ole `project__info`-elementtiä lainkaan.
 * Jäsennin on silti sen arvoinen, koska juuri ne isot hankkeet ovat
 * arvokkaimpia liidejä — mutta tuottoa ei pidä luvata 272:lle.
 */
export type VaylaInfoFields = {
  urakoitsija: string | null
  tilaaja: string | null
  /* Teksti sellaisenaan, esim. "128 miljoonaa euroa". */
  kustannusteksti: string | null
  kustannusEur: number | null
  aikataulu: string | null
}

/*
 * KUSTANNUS LUETAAN KENTÄSTÄ, EI PROOSASTA.
 *
 * `lib/projects/extractCostFromText` vaatii ankkurin tekstistä ("urakan
 * arvo on"), koska se lukee vapaata tiedotetta ja väärä luku olisi
 * pahempi kuin puuttuva. Täällä ankkuri on **kentän otsikko
 * "Kustannukset"**, joka on lähteen oma ilmoitus — eli vahvempi todiste
 * kuin mikään tekstikuvio ([[declared-field-beats-title-regex]]). Siksi
 * arvosta riittää lukea pelkkä numero.
 */
/*
 * Lyhenne "eur" luetaan euroksi (D-395): Vaylan kentassa lukee
 * *"Noin 0,6 milj. eur (suunnittelu)"*.
 */
const MILJOONA = /(\d+(?:[.,]\d+)?)\s*(?:milj(?:oonaa)?\.?)\s*(?:euroa|eur\b|€)/i
const EUROA = /(\d[\d\s ]*)\s*(?:euroa|eur\b|€)/i

/*
 * SELVITYKSEN HINTA EI OLE HANKKEEN HINTA.
 *
 * Merenkurkun kiinteän yhteyden sivulla lukee "Noin 200 000 euroa
 * (esiselvitys)". Se on selvityksen hinta; itse yhteys maksaisi
 * kertaluokkia enemmän, ja 200 000 € kustannusarviona aliarvioisi
 * hankkeen rajusti. Arvo kertoo rajauksensa itse, joten se luetaan
 * ([[source-marks-own-uncertainty]]).
 *
 * SULKUMERKINTÄ RIITTÄÄ RAJAUKSEKSI (D-395). Merven raiteen sivulla
 * kentässä lukee *"Noin 0,6 milj. eur (suunnittelu)"*, ja saman sivun
 * leipäteksti arvioi rakentamisen 11 miljoonaksi — suunnittelun hinta
 * aliarvioisi hankkeen 18-kertaisesti. Ensimmäisessä versiossa tämä
 * meni ohi VAIN siksi ettei lyhennettä "eur" luettu lainkaan; kun
 * lyhenne lisättiin, rajaus oli pakko lisätä samassa muutoksessa.
 */
/*
 * `\b` EI KELPAA KOKO RYHMAN ETEEN. Ensimmainen versio oli
 * `/\b(esiselvity|...|\(\s*suunnittelu)/i`, ja sulkuhaara ei osunut
 * KOSKAAN: "(" on ei-sana-merkki, joten sen eteen ei synny sanarajaa
 * valilyonnista. Mitattu suoraan: "Noin 0,6 milj. eur (suunnittelu)"
 * palautti 600 000 euroa. Sanaraja kuuluu siis vain sanahaaroihin.
 */
const SELVITYKSEN_HINTA =
  /(?:\b(?:esiselvity|selvityksen|suunnittelukustannu|suunnittelun\s+kustannu|hallinnollinen\s+suunnittelu|(?:rata|tie|yleis|hanke|katu)suunnitt)|\(\s*suunnittelu)/i

export function vaylanKustannus(arvo: string | null | undefined): number | null {
  const teksti = String(arvo ?? "")
  if (!teksti.trim()) return null
  if (SELVITYKSEN_HINTA.test(teksti)) return null

  const m = teksti.match(MILJOONA)
  if (m) {
    const luku = Number(m[1].replace(",", "."))
    return Number.isFinite(luku) ? Math.round(luku * 1_000_000) : null
  }

  const e = teksti.match(EUROA)
  if (e) {
    const luku = Number(e[1].replace(/[\s ]/g, ""))
    /*
     * Alle 10 000 € ei ole hankkeen kustannus vaan jokin muu luku
     * ("4 euroa/m2"), ja kenttä on niin harvinainen ettei arvailuun ole
     * syytä.
     */
    return Number.isFinite(luku) && luku >= 10_000 ? luku : null
  }

  return null
}

/*
 * KENTAN ARVO EI OLE AINA URAKOITSIJA (mitattu 7.11.2026).
 *
 * Kuivaharjoitus 272 sivun yli luettiin riveittain, ja "Urakoitsija"
 * -kentassa oli nelja muuta asiaa:
 *
 *   "Naantalin kaupunki, Raision kaupunki..."  kuntia, ei urakoitsijaa
 *   "Salon, Paimion ja Kaarinan kaupungit"     kuntia
 *   "Useita urakoitsijoita"                    ei nimi
 *   "Kilpailutetaan loppuvuonna"               tila, ei nimi
 *
 * Vaaditaan siis yhtiomuoto. Se paastaa lapi "Kreate Oy" ja "GRK Suomi
 * Oy" muttei kuntalistaa eika tilakuvausta. Kunta voi olla tilaaja,
 * muttei taman kentan perusteella ([[party-role-fields]]).
 */
const YHTIOMUOTO = /\b(Oy|Oyj|Ab|Abp|Ky|Ltd|AS|A\/S|GmbH|S\.?p\.?A\.?|s\.r\.l\.)\b/
const EI_NIMI = /\b(useita|kilpailutetaan|ei\s+viela|avoin|ratkeaa|valitaan)\b/i

/*
 * OSAPUOLILISTA EI OLE URAKOITSIJA.
 *
 * Hajala-Nunnan yleissuunnitelmassa kentassa lukee
 * "Salon, Paimion ja Kaarinan kaupungit, Sitowise Oy, Ramboll Oy"
 * -- siina on tilaajakunnat JA konsultit samassa. Oy-osien poimiminen
 * listasta antaisi urakoitsijaksi suunnittelijan, joten koko arvo
 * hylataan kun siina on kuntia.
 */
const KUNTIA = /\b(kaupungit|kunnat|kaupunki|kunta|kuntayhtyma|kuntayhtymä)\b/i

/*
 * SUUNNITTELIJA EI OLE URAKOITSIJA, vaikka kentan otsikko niin sanoo.
 *
 * Suunnitteluvaiheen hankkeessa ("yleissuunnitelma", "ratasuunnitelma")
 * Vaylavirasto merkitsee "Urakoitsija"-kenttaan konsultin: Hajala-Nunna
 * -> Sitowise ja Ramboll, Vt 27 Kiuruvesi -> Afry Finland Oy. Ne ovat
 * `related_companies`-kentan vakea, eivat paaurakoitsijoita
 * ([[party-role-fields]]).
 *
 * Tieto on jo `lib/agent/knowledge/companies.ts`:ssa, jota EI KAYTTANYT
 * MIKAAN ennen tata ([[extractor-exists-unwired]]).
 */
function onSuunnittelija(nimi: string): boolean {
  const puhdas = nimi.toLowerCase()
  return companies.some(
    (y) =>
      (y.role === "designer" || y.role === "consultant") &&
      puhdas.includes(String(y.name).toLowerCase())
  )
}

/*
 * "MP Infra Oy ja Arkos Oy" on KAKSI urakoitsijaa. Erotin on `//`, ei
 * pilkku ([[contractor-from-text]]).
 */
export function vaylanUrakoitsijat(arvo: string | null | undefined): string[] {
  const teksti = String(arvo ?? "").replace(/\s+/g, " ").trim()
  if (!teksti || EI_NIMI.test(teksti) || !YHTIOMUOTO.test(teksti)) return []
  if (KUNTIA.test(teksti)) return []

  return teksti
    .split(/\s+ja\s+|\s*,\s*/)
    .map((o) => o.trim())
    .filter((o) => o && YHTIOMUOTO.test(o) && !onSuunnittelija(o))
}

const AVAIMET: Record<string, keyof VaylaInfoFields> = {
  urakoitsija: "urakoitsija",
  tilaaja: "tilaaja",
  kustannukset: "kustannusteksti",
  aikataulu: "aikataulu",
}

export function parseVaylaInfoFields(html: string | null | undefined): VaylaInfoFields {
  const tyhja: VaylaInfoFields = {
    urakoitsija: null,
    tilaaja: null,
    kustannusteksti: null,
    kustannusEur: null,
    aikataulu: null,
  }
  if (!html) return tyhja

  const $ = cheerio.load(html)
  const ulos = { ...tyhja }

  $(".project__info__additional__item").each((_, el) => {
    const avain = $(el).find("strong").first().text().replace(/\s+/g, " ").trim().toLowerCase()
    const kentta = AVAIMET[avain]
    if (!kentta) return

    /*
     * Arvo on `<strong>`in jälkeinen teksti. `.text()` ottaisi otsikon
     * mukaan ("Urakoitsija Kreate Oy"), joten otsikko poistetaan
     * kopiosta ennen lukemista.
     */
    const kopio = $(el).clone()
    kopio.find("strong").remove()
    const arvo = kopio.text().replace(/\s+/g, " ").trim()
    if (!arvo) return

    if (kentta === "kustannusteksti") {
      ulos.kustannusteksti = arvo
      ulos.kustannusEur = vaylanKustannus(arvo)
    } else if (kentta !== "kustannusEur") {
      ulos[kentta] = arvo
    }
  })

  return ulos
}
