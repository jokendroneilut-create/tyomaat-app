/*
 * Hankkeen kustannusarvio vapaasta tekstistä.
 *
 * `estimated_cost` on ollut olemassa kenttänä ja näkyy asiakkaalle
 * (kooste, hankekortti), mutta mikään ei ole kirjoittanut siihen mitään
 * tekstistä. Mitattu 12.8.2026: 669 riviä mainitsee summan kuvauksessaan.
 *
 * LÄHEISYYS EI RIITÄ ANKKURIKSI. Ensimmäinen versio hyväksyi summan jos
 * lähellä oli rakentamiseen viittaava sana. Se tuotti 391 osumaa, joista
 * mitattuna vääriä olivat mm.:
 *
 *   "Puolustusvoimien investoinnit valtakunnallisesti olivat viime vuonna
 *    356 miljoonaa euroa"            -> koko maan vuosibudjetti
 *   "Hankinnan ennakoitu kokonaisarvo on 1,3 miljoonaa euroa"
 *                                    -> ajoneuvojen huoltoleasing
 *   "on voittanut useita hankkeita yhteensä noin 20 miljoonan euron arvosta"
 *                                    -> yrityksen tilauskanta
 *
 * Siksi summa poimitaan vain nimetystä lauseesta: kustannusarvio, urakan
 * arvo, investointikustannus, "X euron rakennushanke". Sama oppi kuin
 * voittajapoiminnassa - ankkuroi lauseeseen, älä etäisyyteen.
 *
 * VAIN TEKSTIN ALUSTA. Tiedote voi käsitellä useaa hanketta: mitattu
 * tapaus on Iin koulua koskeva tiedote, jonka loppupuolella lukee "Urakan
 * arvo Skanskalle on noin 29 miljoonaa euroa" - Jyväskylän toimistotalosta.
 * Tiedotteen oma aihe kerrotaan alussa, joten haku rajataan siihen.
 */

const LEAD_CHARS = 1200

/* Summa miljoonina: "45 miljoonaa", "9,1 M€", "2 milj. euroa", "11,4 M€". */
const AMOUNT_MILLIONS = "(\\d+(?:[.,]\\d+)?)\\s*(?:miljoonan?|milj\\.?|M€|Meur)"

/*
 * Summa täysinä euroina: "850 000 euroa", "1 250 000 €", "1.250.000 eur".
 *
 * Lisätty 15.8.2026. Poimija tunnisti aiemmin VAIN miljoonia, joten alle
 * miljoonan hankkeet olivat rakenteellisesti näkymättömiä — ja juuri ne ovat
 * enemmistö: Hilman sopimusarvojen mediaani on 278 600 €. Ryhmittelijänä
 * kelpaa väli, sitkeä väli tai piste, koska aineistossa esiintyy kaikkia.
 *
 * Vähintään neljä numeroa, jottei "50 euroa" tai pykälänumero kelpaa.
 */
const AMOUNT_PLAIN =
  "(\\d{1,3}(?:[  .]\\d{3})+|\\d{4,10})\\s*(?:euroa|euron|eur\\b|€)"

/*
 * Alaraja täysille euroille. Rakennushanke ei maksa satasia, joten pienempi
 * luku on lähes varmasti jotain muuta (maksu, sakko, neliöhinta).
 */
const PLAIN_MIN_EUR = 10_000

/* Pehmentimet jotka esiintyvät luvun edessä: "noin", "n.", "enintään". */
const HEDGE = "(?:noin\\s+|n\\.\\s*|enint[aä][aä]n\\s+|arviolta\\s+|l[aä]hes\\s+|yli\\s+)?"

/*
 * Nimetyt lauseet joissa summa ON hankkeen kustannus. Jokainen on mitattu
 * aineistosta; älä lisää kuviota jota et ole nähnyt.
 */

/*
 * Ankkurit rakennetaan kahdesti: kerran miljoonamuodolle, kerran täysille
 * euroille. Lauseet ovat samat — vain summan kirjoitusasu vaihtuu — joten
 * ankkurilistaa ylläpidetään yhdessä paikassa eikä kahtena rinnakkaisena
 * kopiona, joka ehtisi eriytyä.
 */
function anchorsFor(amount: string, bareAmount: string): RegExp[] {
  return [
    // "Hankkeen kustannusarvio on noin 45 miljoonaa euroa"
    new RegExp(`kustannusarvio\\w*\\s+(?:on\\s+|oli\\s+)?${HEDGE}${amount}`, "i"),
    // "Hankkeen kokonaiskustannus on n. 9,1 M€"
    new RegExp(`kokonaiskustannu\\w*\\s+(?:on\\s+|oli\\s+)?${HEDGE}${amount}`, "i"),
    // "arvioitu investointikustannus oli tässä vaiheessa 24,1 milj. euroa"
    new RegExp(
      `investointikustannu\\w*\\s+(?:on\\s+|oli\\s+)?(?:t[aä]ss[aä]\\s+vaiheessa\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    // "Urakan arvo Skanskalle on noin 100 miljoonaa euroa"
    new RegExp(
      `urak\\w*\\s+(?:arvo|hinta)\\w*\\s+(?:\\S+\\s+){0,2}?(?:on\\s+|oli\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    // "Hankkeen kokonaisarvon arvioidaan olevan noin 44 miljoonaa euroa"
    new RegExp(
      `hankkeen\\s+kokonaisarvo\\w*\\s+(?:\\S+\\s+){0,3}?${HEDGE}${amount}`,
      "i"
    ),
    // "30 miljoonan euron rakennusinvestoinnista", "850 000 euron urakasta"
    new RegExp(
      `${bareAmount}\\s+euron\\s+(?:rakennus|uudisrakennus|peruskorjaus|urakka|urakasta|investointi)\\w*`,
      "i"
    ),
  ]
}

/* Sama numero ilman euro-päätettä, kun lause jatkuu sanalla "euron". */
const AMOUNT_MILLIONS_BARE = "(\\d+(?:[.,]\\d+)?)\\s*(?:miljoonan?|milj\\.?)"
const AMOUNT_PLAIN_BARE = "(\\d{1,3}(?:[  .]\\d{3})+|\\d{4,10})"

/*
 * Miljoonat ensin: "45 miljoonaa euroa" osuisi myös täysien eurojen kuvioon
 * ("45" + "miljoonaa euroa" ei osu, mutta järjestys tekee tästä
 * riippumattoman tulevista kuviomuutoksista).
 */
const ANCHOR_SETS: { anchors: RegExp[]; multiplier: number; min: number }[] = [
  {
    anchors: anchorsFor(AMOUNT_MILLIONS, AMOUNT_MILLIONS_BARE),
    multiplier: 1_000_000,
    min: 0,
  },
  {
    anchors: anchorsFor(AMOUNT_PLAIN, AMOUNT_PLAIN_BARE),
    multiplier: 1,
    min: PLAIN_MIN_EUR,
  },
]

/*
 * Koko tekstiä koskevat esteet: nämä kertovat että luku on koontiluku eikä
 * yksittäisen hankkeen kustannus.
 */
const AGGREGATE =
  /valtakunnallisesti|yhteens[aä]\s+(?:noin\s+)?\d|useita\s+hankkeita|tilauskan|liikevaihto|vuosittain|vuodessa|per\s+vuosi|\/vuosi/i

export function extractCostFromText(
  text: string | null | undefined
): number | null {
  if (!text) return null

  const lead = text.slice(0, LEAD_CHARS)

  for (const { anchors, multiplier, min } of ANCHOR_SETS) {
    for (const anchor of anchors) {
      const match = lead.match(anchor)
      if (!match) continue

      /*
       * Este tarkistetaan osuman ympäriltä eikä koko tekstistä: tiedotteessa
       * voi olla erikseen sekä hankkeen kustannus että yrityksen liikevaihto.
       */
      const at = match.index ?? 0
      const window = lead.slice(Math.max(0, at - 80), at + match[0].length + 40)
      if (AGGREGATE.test(window)) continue

      /*
       * Ryhmittelijät pois ennen lukemista ("1 250 000" / "1.250.000"), mutta
       * desimaalipilkku säilytettävä miljoonamuodossa ("12,5 miljoonaa").
       */
      const raw = String(match[1] ?? "")
      const normalized =
        multiplier === 1
          ? raw.replace(/[  .]/g, "")
          : raw.replace(",", ".")

      const value = Number(normalized)
      if (!Number.isFinite(value) || value <= 0) continue

      const euros = Math.round(value * multiplier)
      if (euros < min) continue

      /*
       * Yläraja on tervejärkinen suodatin jäsennysvirheille: Suomen
       * suurimmatkin yksittäiset rakennushankkeet jäävät alle kolmen
       * miljardin, joten sitä suurempi luku on lähes varmasti väärin luettu.
       */
      if (euros > 3_000_000_000) continue

      return euros
    }
  }

  return null
}
