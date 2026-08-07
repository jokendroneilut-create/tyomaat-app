/*
 * Urakkalaji hankkeen nimestä.
 *
 * Sama rakennus kilpailutetaan usein useana erillisenä urakkana, ja ne ovat
 * eri hankkeita käyttäjän kannalta vaikka kohde on sama. Mitattu tapaus,
 * Kuhmon terveysaseman uudisrakennus:
 *
 *   Rakennusurakka Kuhmon terveysaseman uudisrakennus
 *   Sähköurakka Kuhmon terveysaseman uudisrakennus
 *   Ilmanvaihtourakka Kuhmon terveysaseman uudisrakennus
 *   Lämpö-, Vesi- ja Automaatiourakka Kuhmon terveysaseman uudisrakennus
 *
 * Neljä riviä, neljä urakoitsijaa, neljä eri kohdeyleisöä. Täsmäytykselle ne
 * näyttävät duplikaateilta: sama kaupunki, lähes sama nimi, sama rakennuttaja.
 *
 * Tätä käytetään NEGATIIVISENA todisteena: eri urakkalaji estää osuman, se ei
 * koskaan luo sitä. Suunta on tarkoituksellinen — pahin seuraus on että kaksi
 * aitoa duplikaattia jää yhdistämättä, jolloin ihminen näkee ne silti
 * listalla. Väärä yhdistäminen sen sijaan hävittäisi kokonaisen urakan
 * näkyvistä.
 */

export type ContractTrade =
  | "rakennus"
  | "lvi"
  | "sahko"
  | "purku"
  | "maalaus"
  | "maanrakennus"
  | "katto"
  | "piha"

/*
 * Vartalot per laji. Sanan on lisäksi oltava urakkanimitys (ks. alla), jottei
 * kohteen nimi mene lajiksi: "Sähköasema Vantaalle" on hanke, ei sähköurakka.
 */
const TRADE_STEMS: { trade: ContractTrade; stems: string[] }[] = [
  {
    trade: "rakennus",
    stems: ["rakennus", "rakennustekni", "paa", "pää", "kvr", "runko"],
  },
  {
    trade: "lvi",
    stems: [
      "lvi",
      "lvia",
      "lvis",
      /*
       * LV = lämpö ja vesi, vakiintunut lyhenne siinä missä LVI ja IV. Ilman
       * omaa vartaloaan "LV-työt" jäi kokonaan ilman lajia, jolloin veto ei
       * voinut laueta (se vaatii lajin molemmilta puolilta). Mitattu:
       * "Puitejärjestely, LV-työt" ja "Puitejärjestely, rakennusautomaatiotyöt"
       * saivat 95 % eivätkä erottuneet toisistaan.
       */
      "lv",
      "iv",
      "ilmanvaihto",
      "putki",
      "vesi",
      "vesijohto",
      "viemari",
      "viemäri",
      "lampo",
      "lämpö",
    ],
  },
  {
    trade: "sahko",
    stems: ["sahko", "sähkö", "valaistus", "automaatio", "teleteknii"],
  },
  { trade: "purku", stems: ["purku", "purkutyo", "purkutyö"] },
  { trade: "maalaus", stems: ["maalaus", "pinnoitus"] },
  {
    trade: "maanrakennus",
    stems: ["maanrakennus", "maarakennus", "louhinta", "pohjarakennus"],
  },
  { trade: "katto", stems: ["vesikatto", "katto", "kattotyo", "kattotyö"] },
  { trade: "piha", stems: ["piha", "viherrakennus", "viherrakenta", "vihertyo"] },
]

/*
 * Sana lasketaan urakkanimitykseksi vain jos se päättyy urakkaan tai työhön.
 * Näin "sähköurakka" ja "iv-työt" tunnistetaan mutta "sähköasema" ei.
 */
const CONTRACT_SUFFIX = /(urakka|urakat|urakan|urakoita|urakointi|tyot|työt|tyo|työ)$/

/*
 * Sanat siten että yhdysmerkillä kiinnitetty osa pysyy kiinni ("purku-urakka"
 * -> "purkuurakka"), mutta rinnastuksen roikkuva alku jää omaksi tokenikseen
 * loppuviivan kera ("LVI- ja sähköurakka" -> "lvi-", "ja", "sähköurakka").
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-zåäö0-9-]+/g, " ")
    .split(" ")
    .filter(Boolean)
}

export function detectTrades(
  text: string | null | undefined
): Set<ContractTrade> {
  const trades = new Set<ContractTrade>()
  if (!text) return trades

  /*
   * Rinnastettu yhdyssana: "LVI- ja sähköurakka" tarkoittaa sekä LVI-urakkaa
   * että sähköurakkaa, mutta "LVI-" jää ilman urakkapäätettä. Roikkuvat alut
   * kerätään ja yhdistetään seuraavaan urakkanimitykseen, muuten sääntö
   * näkisi vain jälkimmäisen lajin ja estäisi osumia väärin perustein.
   */
  let pendingStems: string[] = []

  /*
   * Pisin osuva vartalo voittaa. Vartalot ovat etuliitteitä, joten lyhyempi
   * voi osua vahingossa pidemmän alkuun: "rakennusautomaatiourakka" osuu sekä
   * vartaloon "rakennus" että "rakennusautomaatio", ja vain jälkimmäinen on
   * oikea laji. Tasapisteissä otetaan kaikki, jotta aidosti monilajiset
   * nimitykset ("lvis-urakka") eivät kavennu yhteen.
   */
  function classify(word: string) {
    let bestLength = 0
    const best: ContractTrade[] = []

    for (const { trade, stems } of TRADE_STEMS) {
      for (const stem of stems) {
        if (!word.startsWith(stem)) continue
        if (stem.length > bestLength) {
          bestLength = stem.length
          best.length = 0
        }
        if (stem.length === bestLength && !best.includes(trade)) best.push(trade)
      }
    }

    for (const trade of best) trades.add(trade)
  }

  for (const raw of tokenize(text)) {
    if (raw.endsWith("-")) {
      pendingStems.push(raw.slice(0, -1))
      continue
    }

    const word = raw.replace(/-/g, "")

    if (!CONTRACT_SUFFIX.test(word)) {
      // "ja" / "sekä" pitää rinnastuksen auki, muu sana katkaisee sen.
      if (raw !== "ja" && raw !== "sekä" && raw !== "seka") pendingStems = []
      continue
    }

    classify(word)

    const suffix = word.match(CONTRACT_SUFFIX)?.[0] ?? ""
    for (const stem of pendingStems) classify(stem + suffix)
    pendingStems = []
  }

  return trades
}

/*
 * Eri urakkalaji = eri hanke. Vaaditaan että MOLEMMILTA löytyy laji ja että
 * joukot ovat täysin erilliset. Jos ne leikkaavat edes yhdellä lajilla (esim.
 * "LVI- ja sähköurakka" vs "sähköurakka"), ei estetä — silloin kyse voi olla
 * samasta urakasta eri sanoin.
 */
export function haveDifferentTrades(
  first: string | null | undefined,
  second: string | null | undefined
): boolean {
  const a = detectTrades(first)
  const b = detectTrades(second)

  if (a.size === 0 || b.size === 0) return false

  for (const trade of a) {
    if (b.has(trade)) return false
  }

  return true
}
