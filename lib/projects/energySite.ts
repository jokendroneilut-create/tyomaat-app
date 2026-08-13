import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"

/*
 * SAMA TUULI-/AURINKOHANKE KAHDESTA MENETTELYSTÄ.
 *
 * Tuulivoimahanke kulkee aina kahta virallista polkua rinnakkain: kunnan
 * osayleiskaava ja ELY:n YVA-menettely. Meille se tulee siksi kahtena
 * rivinä eri nimellä ja eri lähteestä:
 *
 *   YVA:   "Niinimäen tuulivoimahanke, Hattula, Hämeenlinna"
 *   kaava: "Hattulan Niinimäen tuulivoimaosayleiskaava"
 *
 * Mitattu 12.8.2026 viidellä varmennetulla parilla: kaksi ei tuottanut
 * täsmäytyksessä osumaa lainkaan (null) ja kolme jäi 38-50 pisteeseen,
 * kun yhdistäminen vaatii 70. Yksikään ei siis yhdistyisi koskaan.
 *
 * TUNNISTUS PERUSTUU PAIKANNIMEEN, EI HANKETYYPPIIN. Tuulipuiston
 * paikannimi on kunnan sisällä yksilöivä: "Niinimäki Hattulassa" on yksi
 * hanke riippumatta siitä kummasta menettelystä rivi tuli. Pelkkä "sama
 * kunta + tuulivoima" ei riitä alkuunkaan - Siikalatvalla on seitsemän
 * eri tuulipuistoa, ja ne kaikki osuisivat toisiinsa.
 *
 * KUNTANIMET PUDOTETAAN. Otsikoissa luetellaan hankkeen vaikutusalueen
 * kunnat ("…, Hattula, Hämeenlinna"), joten kuntanimi olisi yhteinen
 * sana kahdella eri saman seudun hankkeella eikä todistaisi mitään.
 */
const ENERGY_PROJECT =
  /tuulivoima|tuulipuisto|aurinkovoima|aurinkopuisto|tuulivoimapuisto/i

const SITE_STOPWORD = new Set([
  "tuulivoima",
  "tuulivoimahanke",
  "tuulivoimapuisto",
  "tuulivoimapuiston",
  "tuulivoimaosayleiskaava",
  "tuulipuisto",
  "tuulipuiston",
  "aurinkovoima",
  "aurinkovoimahanke",
  "aurinkopuisto",
  "aurinkopuiston",
  "aurinkovoimapuisto",
  "voimala",
  "voimalat",
  "hanke",
  "hankkeen",
  "hankkeet",
  "puisto",
  "puiston",
  "osayleiskaava",
  "osayleiskaavan",
  "yleiskaava",
  "yleiskaavan",
  "asemakaava",
  "asemakaavan",
  "kaavamuutos",
  "muutos",
  "laajennus",
  "alueen",
  "alue",
  "energy",
  "energia",
  "windfarm",
  "ympäristövaikutusten",
  "arviointi",
  "osayleiskaavaehdotus",
  "osayleiskaavaluonnos",
  "yleistiedoksianto",
  /*
   * SÄHKÖNSIIRTO EI OLE PAIKANNIMI. Tuulipuiston otsikko kertoo lähes aina
   * myös liitynnän ("… tuulivoimapuisto ja sähkönsiirto"), joten ilman
   * tätä sana on kahdella eri hankkeella yhteinen "paikannimi". Mitattu:
   * Pihtiputaan Uusimo osui sekä Varisvuoreen (90) että Leppäkankaaseen
   * (83) pelkän sähkönsiirron perusteella, ja väärä osuma oli vielä
   * oikeaa vahvempi.
   */
  "sähkönsiirto",
  "sähkönsiirron",
  "sähkösiirto",
  "sähköasema",
  "voimajohto",
  "voimajohdon",
  "voimajohtohanke",
  "kilovoltin",
  "liityntä",
])

/*
 * Ilmansuunta erottaa saman paikan osahankkeet toisistaan: Kauhajoella on
 * erikseen "Pallonevan pohjoinen" ja "Pallonevan eteläinen", jotka ovat eri
 * hankkeita eri yhtiöillä. Suunta vetoaa VAIN kun molemmat nimet ilmoittavat
 * suunnan ja ne eroavat - Ranualla YVA puhuu Kupinavaarasta ilman suuntaa ja
 * kaava kattaa "itäisen ja läntisen", jolloin kyse on samasta hankkeesta.
 */
const DIRECTION_STEMS: [RegExp, string][] = [
  [/^pohjoi/, "N"],
  [/^etelä/, "S"],
  [/^itä/, "E"],
  [/^länt|^länsi/, "W"],
]

/*
 * Laajennus on eri hanke kuin alkuperäinen puisto, vaikka paikannimi on
 * sama: "Kaukasennevan tuulivoimapuisto" ja "…puiston laajennus" ovat
 * kaksi erillistä kaavaa ja kahdet urakat. Sama symmetriavaatimus kuin
 * ilmansuunnalla - laajennus erottaa vain jos toinen puoli on ilman.
 */
const EXPANSION = /laajennu|lisäraken/i

const MIN_SITE_WORD = 6
const MIN_SHARED_PREFIX = 6

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .split(/[^a-zåäö0-9-]+/)
    .flatMap((word) => word.split("-"))
    .map((word) => word.trim())
    .filter(Boolean)
}

function directions(words: string[]): Set<string> {
  const found = new Set<string>()
  for (const word of words) {
    for (const [pattern, code] of DIRECTION_STEMS) {
      if (pattern.test(word)) found.add(code)
    }
  }
  return found
}

/*
 * VARTALO, EI TÄYSI SANA.
 *
 * Tarkka sanalista ei kestä suomen taivutusta: listassa oli "tuulivoima"
 * mutta ei partitiivia "tuulivoimaa", joten "Vitsakankaan TUULIVOIMAA
 * koskeva osayleiskaava" ja "Pitkämaan TUULIVOIMAA koskeva osayleiskaava"
 * saivat yhteisen "paikannimen" ja näyttivät samalta kohteelta.
 *
 * Vika oli vaarallisempi yhdistämissuuntaan kuin erottamiseen: yhteinen
 * geneerinen sana riittää `haveSameEnergySite`-ehtoon, joten kaksi eri
 * tuulipuistoa saattoi yhdistyä sanalla jota ei edes tarkoitettu
 * paikannimeksi.
 *
 * Vartalot on valittu niin etteivät ne ole uskottavia paikannimien
 * alkuja. Yleissanat kuten "hanke", "puisto" ja "alue" jäävät tarkkaan
 * listaan, koska ne esiintyvät myös paikannimissä (Hankasalmi).
 */
const SITE_STOPWORD_STEM =
  /^(?:tuulivoim|tuulipuist|aurinkovoim|aurinkopuist|voimalait|voimajoht|sähkönsiirt|sähkösiirt|sähköasem|osayleiskaav|yleiskaav|asemakaav|kaavamuuto|koskev|ympäristövaikutu|arvioint|liitynt|kilovolt|windfarm)/

function siteWords(words: string[], city: string | null | undefined): string[] {
  const cityStem = city ? city.toLowerCase().slice(0, MIN_SHARED_PREFIX) : null

  return words.filter((word) => {
    if (word.length < MIN_SITE_WORD) return false
    if (SITE_STOPWORD.has(word)) return false
    if (SITE_STOPWORD_STEM.test(word)) return false
    if (getMunicipalityByAnyForm(word)) return false
    if (cityStem && word.startsWith(cityStem)) return false
    return true
  })
}

/*
 * Taivutus hoidetaan yhteisellä alkuosalla, ei sanavartalolla: astevaihtelu
 * tekee perusmuodon palauttamisesta epäluotettavaa ("Vaarinkangas" ->
 * "Vaarinkankaan", "Repojänkä" -> "Repojängän"). Kuuden merkin yhteinen
 * alku riittää erottamaan paikannimet toisistaan.
 */
function sharesPrefix(a: string, b: string): boolean {
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length < MIN_SHARED_PREFIX) return false
  return longer.startsWith(shorter.slice(0, Math.max(MIN_SHARED_PREFIX, shorter.length - 2)))
}

export function isEnergyProjectName(name: string | null | undefined): boolean {
  return !!name && ENERGY_PROJECT.test(name)
}

/*
 * Ovatko nimet saman tuuli-/aurinkohankkeen kaksi menettelyä?
 *
 * Vaatii: molemmat energiahankkeita, yhteinen paikannimi (kuntanimet ja
 * hanketyyppisanat pois luettuna) eikä eroavaa ilmansuuntaa.
 */
export function haveSameEnergySite(
  nameA: string | null | undefined,
  nameB: string | null | undefined,
  city: string | null | undefined,
  textA?: string | null,
  textB?: string | null
): boolean {
  /*
   * Hanketyyppi saa tulla kuvauksesta, paikannimi ei. Kaavarivi jättää
   * tyypin toisinaan pois otsikosta ("Kummunmaa ja Repojänkä, Winda Energy
   * Oy"), mutta kuvaus kertoo sen aina. Erottelijana pysyy silti otsikon
   * paikannimi, joten laajennus ei löysää tunnistusta - se vain sallii
   * portin läpi rivit joiden otsikko on niukka.
   */
  const energyA = isEnergyProjectName(nameA) || isEnergyProjectName(textA)
  const energyB = isEnergyProjectName(nameB) || isEnergyProjectName(textB)
  if (!energyA || !energyB) return false
  if (!nameA || !nameB) return false

  const wordsA = tokenize(nameA!)
  const wordsB = tokenize(nameB!)

  if (EXPANSION.test(nameA) !== EXPANSION.test(nameB)) return false

  const dirA = directions(wordsA)
  const dirB = directions(wordsB)
  if (dirA.size > 0 && dirB.size > 0) {
    const shared = [...dirA].some((d) => dirB.has(d))
    if (!shared) return false
  }

  const sitesA = siteWords(wordsA, city)
  const sitesB = siteWords(wordsB, city)
  if (!sitesA.length || !sitesB.length) return false

  return sitesA.some((a) => sitesB.some((b) => sharesPrefix(a, b)))
}

/*
 * ERI PAIKANNIMI SAMASSA KUNNASSA = ERI HANKE.
 *
 * `haveSameEnergySite` yhdistää saman kohteen rivit. Tämä on sen pari
 * toiseen suuntaan, ja se on yhtä tarpeellinen: energiahankkeiden
 * otsikot ovat lähes identtisiä, koska erottava tieto on yksi sana.
 *
 * Mitattu 13.8.2026 täydellä duplikaattiskannauksella: 68 uudesta
 * ehdokkaasta **51 oli tätä kuviota**. Tervolassa kuusi eri tuulipuistoa
 * ristiinpariutui 15 pariksi, koska otsikoista neljä sanaa viidestä on
 * samoja:
 *
 *   "Vitsakankaan tuulivoimaa koskeva osayleiskaava"
 *   "Pitkämaan tuulivoimaa koskeva osayleiskaava"
 *
 * Ilman tätä jokainen täysi skannaus tuottaa saman kohinan, ja
 * katselmointi menettää merkityksensä - 51 väärää paria hukuttaa alleen
 * ne kolme aitoa.
 *
 * PAIKANNIMEN PUUTTUMINEN EI OLE TODISTE. Jos kummallakaan otsikolla ei
 * ole tunnistettavaa paikannimeä ("Datakeskus"), palautetaan false eikä
 * estetä mitään - tyhjä on parempi kuin väärä myös tähän suuntaan.
 */
export function haveDifferentEnergySites(
  nameA: string | null | undefined,
  nameB: string | null | undefined,
  city: string | null | undefined,
  textA?: string | null,
  textB?: string | null
): boolean {
  const energyA = isEnergyProjectName(nameA) || isEnergyProjectName(textA)
  const energyB = isEnergyProjectName(nameB) || isEnergyProjectName(textB)
  if (!energyA || !energyB) return false
  if (!nameA || !nameB) return false

  const sitesA = siteWords(tokenize(nameA), city)
  const sitesB = siteWords(tokenize(nameB), city)
  if (!sitesA.length || !sitesB.length) return false

  return !sitesA.some((a) => sitesB.some((b) => sharesPrefix(a, b)))
}
