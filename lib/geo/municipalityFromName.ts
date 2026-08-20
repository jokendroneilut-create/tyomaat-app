/*
 * Kunnan päättely vapaamuotoisesta nimestä: hankintayksikön nimestä
 * ("Janakkalan kunta") tai postitoimipaikasta ("14200 Turenki").
 *
 * Kuntarekisteri (municipalities.ts) tuntee vain perusmuotoiset kuntanimet,
 * mutta Hilman aineistossa kunta esiintyy lähes aina joko genetiivissä tai
 * postitoimipaikkana, joka ei ole kunta lainkaan. Tässä ne muunnetaan
 * takaisin rekisterin tuntemaan muotoon — aina rekisteriä vasten
 * validoiden, joten mitään ei arvata.
 */
import {
  MUNICIPALITIES,
  getMunicipalityByName,
  type Municipality,
} from "./municipalities"

const ALL_MUNICIPALITIES: Municipality[] = Object.values(MUNICIPALITIES)

/*
 * Postitoimipaikkoja ja kyliä jotka eivät ole omia kuntiaan. Hilman
 * hankintayksikön osoitteessa "kaupunki" on postitoimipaikka, ei kunta:
 * "14200 Turenki" on Janakkalan kirkonkylä, jolloin suora kuntarekisterihaku
 * palauttaa tyhjän ja koko hankkeen sijainti jää tunnistamatta.
 *
 * Alla olevat on MITATTU aineistosta 21.8.2026
 * (`scripts/measure-unknown-place-names.ts`), ei arvattu. Lisää vain nimiä
 * jotka esiintyvät oikeasti ja joiden kunta on yksikäsitteinen — esim.
 * "Kuivasjärvi" on sekä Oulussa että Parkanossa, joten se jätettiin pois.
 */
const POSTAL_PLACE_MUNICIPALITIES: Record<string, string> = {
  turenki: "Janakkala",
  ivalo: "Inari",
  onttola: "Kontiolahti",
  immola: "Imatra",
  hikiä: "Hausjärvi",
  sirkka: "Kittilä", // Levin kylä
  rukatunturi: "Kuusamo",
  tervakoski: "Janakkala",
  nummela: "Vihti",
  vesivehmaa: "Asikkala",
  vekaranjärvi: "Kouvola", // varuskunta, ent. Valkeala
  ylämylly: "Liperi",
  kelloselkä: "Salla",
  impiö: "Ranua",
  nukari: "Nurmijärvi",
}

/*
 * LAKANNEET KUNNAT. Kuntaliitoksessa nimi jää elämään postitoimipaikkana ja
 * puheessa vuosikymmeniksi, joten sitä esiintyy aineistossa yhä.
 */
const MERGED_MUNICIPALITIES: Record<string, string> = {
  nauvo: "Parainen", // 2009
  kuusankoski: "Kouvola", // 2009
  eno: "Joensuu", // 2009
  noormarkku: "Pori", // 2010
  haukipudas: "Oulu", // 2013
  mänttä: "Mänttä-Vilppula", // 2009
  jurva: "Kurikka", // 2009
  pertunmaa: "Mäntyharju", // 2025, tuorein kuntaliitos
}

/*
 * RUOTSINKIELISET KUNTANIMET. Kaksikielisen kunnan ilmoitus voi käyttää
 * kumpaa nimeä tahansa: mitattu 21.8.2026 suorituspaikkakentästä
 * "JAKOBSTAD", jolloin kunta jäi tyhjäksi vaikka osoite saatiin.
 *
 * Kattaa virallisesti kaksikieliset kunnat. Nimet ovat yksikäsitteisiä
 * eivätkä osu mihinkään suomenkieliseen kunnannimeen.
 *
 * HUOM: "Pedersöre" ja "Mariehamn" osoittavat rekisterin virallisiin
 * nimiin "Pedersören kunta" ja "Maarianhamina - Mariehamn", joita ei
 * kirjoiteta aineistoon sellaisenaan.
 */
const SWEDISH_MUNICIPALITY_NAMES: Record<string, string> = {
  esbo: "Espoo",
  hangö: "Hanko",
  helsingfors: "Helsinki",
  ingå: "Inkoo",
  jakobstad: "Pietarsaari",
  karleby: "Kokkola",
  kaskö: "Kaskinen",
  kimitoön: "Kemiönsaari",
  kristinestad: "Kristiinankaupunki",
  kronoby: "Kruunupyy",
  kyrkslätt: "Kirkkonummi",
  lappträsk: "Lapinjärvi",
  larsmo: "Luoto",
  lovisa: "Loviisa",
  malax: "Maalahti",
  mariehamn: "Maarianhamina - Mariehamn",
  mörskom: "Myrskylä",
  nykarleby: "Uusikaarlepyy",
  närpes: "Närpiö",
  pargas: "Parainen",
  pedersöre: "Pedersören kunta",
  raseborg: "Raasepori",
  sibbo: "Sipoo",
  sjundeå: "Siuntio",
  vanda: "Vantaa",
  vasa: "Vaasa",
  vörå: "Vöyri",
  åbo: "Turku",
  borgå: "Porvoo",
  borgnäs: "Pornainen",
  grankulla: "Kauniainen",
  korsholm: "Mustasaari",
  pyttis: "Pyhtää",
}

/*
 * Rekisterin virallinen nimi poikkeaa arkinimestä myös suomeksi:
 * Tilastokeskuksella Maarianhamina on "Maarianhamina - Mariehamn".
 */
const REGISTRY_NAME_ALIASES: Record<string, string> = {
  maarianhamina: "Maarianhamina - Mariehamn",
}

/*
 * Genetiivit joissa vartalo muuttuu niin paljon, ettei alla oleva 5 merkin
 * yhteinen alku riitä (nimi on lyhyt): "Turun" -> Turku, "Lahden" -> Lahti.
 * Pidemmillä nimillä astevaihtelu ei haittaa, koska alku säilyy.
 */
const GENITIVE_EXCEPTIONS: Record<string, string> = {
  turun: "Turku",
  lahden: "Lahti",
  vihdin: "Vihti",
  hangon: "Hanko",
  liedon: "Lieto",
  lopen: "Loppi",
}

/*
 * Kuntarekisterihaku joka tuntee myös postitoimipaikat, lakanneet kunnat ja
 * ruotsinkieliset nimet. Kaikki aliakset ratkaistaan rekisteriä vasten, joten
 * kirjoitusvirhe tai tuntematon nimi palauttaa tyhjän eikä arvausta.
 */
export const PLACE_ALIASES: Record<string, string> = {
  ...POSTAL_PLACE_MUNICIPALITIES,
  ...MERGED_MUNICIPALITIES,
  ...SWEDISH_MUNICIPALITY_NAMES,
  ...REGISTRY_NAME_ALIASES,
}

export function getMunicipalityByPlaceName(
  name: string | null | undefined
): Municipality | null {
  const direct = getMunicipalityByName(name)
  if (direct) return direct

  if (!name) return null

  const alias = PLACE_ALIASES[name.trim().toLowerCase()]
  return alias ? getMunicipalityByName(alias) : null
}

/*
 * Genetiivimuodosta kunnaksi: "Janakkalan" -> Janakkala.
 *
 * Kolme askelta järjestyksessä: poikkeuslista, säännöllinen genetiivi
 * (nimi + "n"), ja lopuksi vartalonmuutokset (Helsingin -> Helsinki,
 * Riihimäen -> Riihimäki) 5 merkin yhteisellä alulla. Viimeinen vaatii
 * yksikäsitteisen osuman: jos alku sopii kahteen kuntaan, palautetaan null
 * eikä arvata kumpaakaan.
 */
export function municipalityFromGenitive(
  word: string | null | undefined
): Municipality | null {
  if (!word) return null

  const w = word.trim().toLowerCase()
  if (w.length < 4 || !w.endsWith("n")) return null

  const exception = GENITIVE_EXCEPTIONS[w]
  if (exception) return getMunicipalityByName(exception)

  const direct = getMunicipalityByName(w.slice(0, -1))
  if (direct) return direct

  const matches = ALL_MUNICIPALITIES.filter(
    (m) =>
      m.name.length >= 5 && w.startsWith(m.name.slice(0, 5).toLowerCase())
  )

  return matches.length === 1 ? matches[0] : null
}

/*
 * Kuntakenttä sellaisena kuin se aineistossa esiintyy: perusmuoto, kylän tai
 * lakanneen kunnan nimi, tai genetiivi ("Helsingin"). Kaupunki-sarakkeeseen
 * on päätynyt kaikkia näitä, koska se on poimittu vapaasta tekstistä.
 */
export function getMunicipalityByAnyForm(
  name: string | null | undefined
): Municipality | null {
  return getMunicipalityByPlaceName(name) ?? municipalityFromGenitive(name)
}

const BUYER_NAME_RE =
  /\b([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]*n)\s+(kunta|kunnan|kaupunki|kaupungin)\b/i

/*
 * Kunta hankintayksikön nimestä: "Janakkalan kunta" -> Janakkala,
 * "Stara (Helsingin kaupungin rakentamispalveluliikelaitos)" -> Helsinki.
 *
 * Käytetään vasta viimeisenä keinona, kun työmaan kaupunkia ei löydy
 * ilmoituksen tekstistä eikä osoitteesta: kunta tilaajana rakennuttaa
 * käytännössä aina omalle alueelleen. Osalla hankkeista yhtä työmaaosoitetta
 * ei ole olemassakaan (esim. päällysteurakka kattaa kunnan koko katuverkon),
 * jolloin tilaajakunta on ainoa mielekäs sijainti.
 *
 * "kuntayhtymä" ei osu tähän (\b estää), ja se on tarkoituksellista:
 * kuntayhtymä kattaa useita kuntia eikä sen nimestä voi päätellä sijaintia.
 */
export function municipalityFromBuyerName(
  name: string | null | undefined
): Municipality | null {
  if (!name) return null

  const match = name.match(BUYER_NAME_RE)
  if (!match) return null

  return municipalityFromGenitive(match[1])
}

/*
 * Hankintayksikön osoite on Suomessa aina muotoa "<katu> <postinumero>
 * <kaupunki> FIN" — kaupunki on nimessä perusmuodossa, joten se on
 * poimittavissa luotettavasti toisin kuin vapaan tekstin taivutusmuodot.
 */
export function extractCityFromBuyerAddress(
  buyerAddress: string | null | undefined
): string | null {
  if (!buyerAddress) return null

  const match = buyerAddress.match(
    /\d{5}\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*(?:\s[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*)*)\s+FIN\s*$/
  )

  return match?.[1]?.trim() ?? null
}

/*
 * Tukeeko ilmoituksen oma teksti samaa kaupunkia? Taivutusmuotojen takia
 * (esim. "Orivesi" -> "Orivedellä") verrataan vain nimen alkuosaa.
 */
export function isCityCorroboratedByText(
  city: string,
  ...texts: (string | null | undefined)[]
): boolean {
  const stem = city.toLowerCase().slice(0, Math.min(5, city.length))

  return texts.some((text) => text && text.toLowerCase().includes(stem))
}

/*
 * YHDEN KOHTEEN KIINTEISTÖYHTIÖ: OSOITE ON KOHDE.
 *
 * Kiinteistö- ja asunto-osakeyhtiö perustetaan yhtä kiinteistöä varten, ja
 * sen rekisteriosoite on se kiinteistö - usein nimeä myöten ("Kiinteistö Oy
 * Eliel Saarisen tie 41-45"). Tilaajan osoite ei siis ole pääkonttori kuten
 * valtakunnallisilla toimijoilla, joten kunta voidaan lukea siitä ilman
 * että ilmoituksen teksti mainitsisi kaupunkia.
 *
 * Mitattu 12.8.2026: 298 kunnatonta riviä, joista 13 oli Englantilaisen
 * koulun urakoita samalta tilaajalta. Kuvaus ei mainitse Helsinkiä
 * kertaakaan ("Englantilainen koulu-uudisrakennushankkeen varusteurakka"),
 * joten isCityCorroboratedByText hylkäsi kaupungin ja kunta jäi tyhjäksi.
 *
 * VALTAKUNNALLINEN VOITTAA. Puolustuskiinteistöt sisältää sanan
 * "kiinteistö" mutta rakennuttaa koko maahan: sen Helsingin-osoite veisi
 * hankkeet väärään kuntaan.
 */
const NATIONAL_BUYER =
  /puolustuskiinteistöt|senaatti|metsähallitus|väylävirasto|liikennevirasto|puolustusvoim|defence\s+force|rajavartio|museovirasto|ely-keskus|hyvinvointialue|sairaanhoitopiiri|yliopisto|fingrid|gasgrid|finavia/i

const SINGLE_PROPERTY_COMPANY = /kiinteistö|asunto\s*oy|\bas\.?\s*oy\b/i

export function isSinglePropertyCompany(buyer: string | null | undefined): boolean {
  if (!buyer) return false
  if (NATIONAL_BUYER.test(buyer)) return false
  return SINGLE_PROPERTY_COMPANY.test(buyer)
}
