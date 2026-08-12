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

/* Summa: "45 miljoonaa", "9,1 M€", "2 milj. euroa", "11,4 M€". */
const AMOUNT = "(\\d+(?:[.,]\\d+)?)\\s*(?:miljoonan?|milj\\.?|M€|Meur)"

/* Pehmentimet jotka esiintyvät luvun edessä: "noin", "n.", "enintään". */
const HEDGE = "(?:noin\\s+|n\\.\\s*|enint[aä][aä]n\\s+|arviolta\\s+|l[aä]hes\\s+|yli\\s+)?"

/*
 * Nimetyt lauseet joissa summa ON hankkeen kustannus. Jokainen on mitattu
 * aineistosta; älä lisää kuviota jota et ole nähnyt.
 */
const ANCHORS = [
  // "Hankkeen kustannusarvio on noin 45 miljoonaa euroa"
  new RegExp(`kustannusarvio\\w*\\s+(?:on\\s+|oli\\s+)?${HEDGE}${AMOUNT}`, "i"),
  // "Hankkeen kokonaiskustannus on n. 9,1 M€"
  new RegExp(`kokonaiskustannu\\w*\\s+(?:on\\s+|oli\\s+)?${HEDGE}${AMOUNT}`, "i"),
  // "arvioitu investointikustannus oli tässä vaiheessa 24,1 milj. euroa"
  new RegExp(
    `investointikustannu\\w*\\s+(?:on\\s+|oli\\s+)?(?:t[aä]ss[aä]\\s+vaiheessa\\s+)?${HEDGE}${AMOUNT}`,
    "i"
  ),
  // "Urakan arvo Skanskalle on noin 100 miljoonaa euroa"
  new RegExp(`urak\\w*\\s+(?:arvo|hinta)\\w*\\s+(?:\\S+\\s+){0,2}?(?:on\\s+|oli\\s+)?${HEDGE}${AMOUNT}`, "i"),
  // "Hankkeen kokonaisarvon arvioidaan olevan noin 44 miljoonaa euroa"
  new RegExp(
    `hankkeen\\s+kokonaisarvo\\w*\\s+(?:\\S+\\s+){0,3}?${HEDGE}${AMOUNT}`,
    "i"
  ),
  // "30 miljoonan euron rakennusinvestoinnista", "20 miljoonan euron rakennushankkeen"
  new RegExp(
    `${AMOUNT}\\s+euron\\s+(?:rakennus|uudisrakennus|peruskorjaus|urakka|investointi)\\w*`,
    "i"
  ),
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

  for (const anchor of ANCHORS) {
    const match = lead.match(anchor)
    if (!match) continue

    /*
     * Este tarkistetaan osuman ympäriltä eikä koko tekstistä: tiedotteessa
     * voi olla erikseen sekä hankkeen kustannus että yrityksen liikevaihto.
     */
    const at = match.index ?? 0
    const window = lead.slice(Math.max(0, at - 80), at + match[0].length + 40)
    if (AGGREGATE.test(window)) continue

    const raw = match[1] ?? match[2]
    const value = Number(String(raw).replace(",", "."))
    if (!Number.isFinite(value) || value <= 0) continue

    /*
     * Yläraja on tervejärkinen suodatin jäsennysvirheille: Suomen
     * suurimmatkin yksittäiset rakennushankkeet jäävät alle kolmen
     * miljardin, joten sitä suurempi luku on lähes varmasti väärin luettu.
     */
    if (value > 3000) continue

    return Math.round(value * 1_000_000)
  }

  return null
}
