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
const HEDGE = "(?:noin\\s*|n\\.\\s*|enint[aä][aä]n\\s+|arviolta\\s+|l[aä]hes\\s+|yli\\s+)?"

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
    /*
     * "Sopimuksen arvo SRV:lle on noin 21,5 miljoonaa euroa"
     *
     * Mitattu 15.8.2026 SRV:n Hämeenlinnan Lyseo -tiedotteesta. Tämä on
     * pörssiyhtiön vakiomuoto voitetulle urakalle — arvo ilmoitetaan
     * SOPIMUKSEN eikä urakan arvona, koska tieto on sijoittajille olennainen.
     * Ilman tätä ankkuria juuri suurimmat voitetut urakat jäivät poimimatta.
     */
    new RegExp(
      `sopimu\\w*\\s+(?:arvo|hinta)\\w*\\s+(?:\\S+\\s+){0,2}?(?:on\\s+|oli\\s+)?${HEDGE}${amount}`,
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
/*
 * "tilauskanta" oli tässä aluksi paljaana, koska koontiluku esiintyy usein
 * sen lähellä ("on voittanut useita hankkeita yhteensä 20 miljoonan euron
 * arvosta"). Mitattu 15.8.2026: se torjui myös aidot yksittäiset sopimukset,
 * koska urakoitsijatiedotteen VAKIOFRAASI on "Sopimuksen arvo on noin 18
 * miljoonaa euroa ja se kirjataan yhtiön tilauskantaan" — tilauskanta
 * mainitaan nimenomaan siksi että kyse on yhdestä uudesta sopimuksesta.
 *
 * Este rajattiin muotoon jossa tilauskanta ITSE on luvun kohde
 * ("tilauskanta oli 1,2 miljardia"). Alkuperäiset mitatut väärät osumat
 * torjuu yhä `useita hankkeita` ja `yhteensä <luku>`.
 */
const AGGREGATE =
  /valtakunnallisesti|yhteens[aä]\s+(?:noin\s+)?\d|useita\s+hankkeita|tilauskanta\w*\s+(?:on|oli|kasvoi|nousi|kehittyi)|liikevaihto|vuosittain|vuodessa|per\s+vuosi|\/vuosi/i

/*
 * Puite- ja palvelusopimus ei ole hanke. Tämä on erillinen este
 * "sopimuksen arvo" -ankkurille: mitattu tapaus on "Toistaiseksi voimassa
 * olevan sopimuksen arvo on 10 miljoonaa euroa" (Tiera Oy:n palveluhankinta),
 * joka on sopimuksen arvo muttei rakennushankkeen kustannus. Muut ankkurit
 * (kustannusarvio, urakan arvo) eivät tarvitse tätä, koska ne sanovat jo
 * itse mistä on kyse.
 */
const FRAMEWORK_CONTRACT =
  /toistaiseksi\s+voimassa|puitesopimu|puitej[aä]rjestely|vuosisopimu|optiokau/i

/*
 * PAATOSASIAKIRJA ON ERI TEKSTILAJI KUIN TIEDOTE.
 *
 * Ylla oleva 1 200 merkin ikkuna ja koontiluku-este on rakennettu
 * TIEDOTETTA varten: tiedote kasittelee usein useaa hanketta, ja sen oma
 * aihe kerrotaan alussa. Kunnan paatosasiakirja on painvastainen - se
 * kasittelee yhta asiaa, ja summa on syvalla "Selostus"-osiossa.
 *
 * MITATTU 1.9.2026 koko nakyvalla joukolla (5 717 hanketta): 905 mainitsee
 * summan kuvauksessaan mutta vain 77:lta se oli poimittu. **524 rivilla
 * summa on vasta 1 200 merkin jalkeen**, eli poimija ei nahnyt sita
 * lainkaan. Laukaisevana tapauksena oli Kivenlahden pukutilat, jonka
 * teksti sanoo suoraan "Hankkeelle on varattu investointiohjelmassa
 * 2,0 M€" - merkissa 1 250.
 *
 * Ankkurit alla on luettu aineistosta, ei keksitty:
 *
 *   rakennuskustannukset ovat ...      177 rivia  (katu- ja puistosuunnitelmat)
 *   enimmaishinta on alv 0 ...          63 + 12   (Helsingin hankesuunnitelmat)
 *   rakentamisen kustannukset ovat ...  36
 *   hankkeelle on varattu ...           37
 *
 * KAKSI MUOTOA ON TARKOITUKSELLA ULKONA. "Yllapitokustannukset ovat noin
 * 13 500 euroa" on vuosittainen yllapito, ei hankkeen hinta (156 rivia,
 * yleisin yksittainen muoto koko aineistossa). "Kaynnistamiskustannuksiin
 * varataan noin 450 000 euroa" on kalusteraha koulun tai paivakodin
 * avaamiseen, kun rakennus itse maksaa kymmenia miljoonia (36 rivia).
 * Kumpikin naytti ankkurilta ja kumpikin olisi kirjoittanut vaaran luvun.
 */
function documentAnchorsFor(amount: string): RegExp[] {
  return [
    /* "Katusuunnitelman rakennuskustannukset ovat yhteensa noin 880 000 euroa" */
    new RegExp(
      `rakennuskustannu\\w*\\s+(?:ovat|on)\\s+(?:yhteens[aä]\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    /* "Rakentamisen kustannukset ovat noin 250 000 euroa" */
    new RegExp(
      `rakentamisen\\s+kustannu\\w*\\s+(?:ovat|on)\\s+(?:yhteens[aä]\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    /* "Hankkeen enimmaishinta on arvonlisaverottomana 20 840 000 euroa" */
    new RegExp(
      `enimm[aä]ishinta\\w*(?:-arvio)?\\s+(?:on\\s+)?(?:arvonlis[aä]verottomana\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    /* "Arvonlisaveroton enimmaishinta on 5 400 000 euroa" */
    new RegExp(
      `arvonlis[aä]verot\\w*\\s+enimm[aä]ishinta\\w*\\s+(?:on\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    /* "Hankkeen kustannukset ovat noin 3,2 miljoonaa euroa" (Vaylavirasto) */
    new RegExp(
      `hankkeen\\s+kustannu\\w*\\s+(?:ovat|on)\\s+(?:yhteens[aä]\\s+)?${HEDGE}${amount}`,
      "i"
    ),
    /* "Hankkeen kustannusarvio on 2,0 M€" myos tekstin loppupuolella */
    new RegExp(`kustannusarvio\\w*\\s+(?:on\\s+|oli\\s+)?${HEDGE}${amount}`, "i"),
    /* "Hankkeelle on varattu investointiohjelmassa 2,0 M€" */
    new RegExp(`varattu\\s+(?:\\S+\\s+){0,3}?${HEDGE}${amount}`, "i"),
  ]
}

const DOCUMENT_SETS: { anchors: RegExp[]; multiplier: number; min: number }[] = [
  { anchors: documentAnchorsFor(AMOUNT_MILLIONS), multiplier: 1_000_000, min: 0 },
  { anchors: documentAnchorsFor(AMOUNT_PLAIN), multiplier: 1, min: PLAIN_MIN_EUR },
]

/*
 * Esteet paatosankkureille. Nama ovat eri asia kuin tiedotteen
 * koontiluvut: tassa torjutaan sivukulu joka esiintyy samassa
 * asiakirjassa hankkeen oman hinnan kanssa.
 * TOIMIVALTAFRAASI ON PAHIN NAISTA. Helsingin jaostopaatoksissa on
 * vakiolause paatosvallan rajasta. Se esiintyy kahdessa muodossa:
 * "...jaosto tai sen maaraama viranomainen hyvaksyy tilahankkeita
 * koskevat suunnitelmat, kun kustannusarvio on enintaan 5 miljoonaa"
 * ja "...jaosto paattaa tilahankkeista, joiden kustannusarvio on
 * enintaan 5 miljoonaa". Kumpikin on paatoksentekosaanto eika
 * hankkeen hinta. Mitattu 1.9.2026: seitseman hanketta olisi saanut
 * arvon 5 000 000, kun asiakirjassa lukee 1 300 000, 1 155 000,
 * 1 411 815 ja 8 144 446.
 */
const SIDE_COST =
  /yll[aä]pitokustannu|k[aä]ynnist[aä]miskustannu|k[aä]ynnist[aä]misraha|irtaimist|vuokrakustannu|euroa\s*\/\s*m|(?:p[aä][aä]tt[aä][aä]|p[aä][aä]tt[aä]nyt|p[aä][aä]tti|hyv[aä]ksyy)\s+tilahank|p[aä][aä]t[oö]svalta/i

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
       * Puite-este koskee vain "sopimuksen arvo" -ankkuria; tunnistetaan
       * osumasta itsestään, jotta ankkurilista pysyy yhtenä taulukkona.
       */
      if (/^sopimu/i.test(match[0]) && FRAMEWORK_CONTRACT.test(window)) continue

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

  /*
   * PAATOSPASSI. Ajetaan vasta kun tiedoteankkurit eivat loytaneet
   * mitaan, ja koko tekstista: paatosasiakirjassa summa on syvalla
   * "Selostus"-osiossa (524 riviä mitattu 1.9.2026). Koontiluku-estetta
   * EI kayteta, koska sen "yhteensa <luku>" torjuisi juuri sen muodon
   * jossa katusuunnitelman oma hinta ilmoitetaan ("rakennuskustannukset
   * ovat yhteensa noin 1 240 000 euroa"). Tilalla on sivukuluesto.
   */
  for (const { anchors, multiplier, min } of DOCUMENT_SETS) {
    for (const anchor of anchors) {
      const match = text.match(anchor)
      if (!match) continue

      /*
       * ESTE KATSOO VAIN TAAKSEPAIN.
       *
       * Ensimmainen versio katsoi myos osuman jalkeen, ja se torjui
       * kelvollisia rivejä: Helsingin katusuunnitelmissa lukee
       * "rakennuskustannukset ovat yhteensa noin 1 240 000 euroa,
       * 470 euroa/m²" - nelihinta on vertailuluku, joka seuraa oikeaa
       * summaa. Kaikki torjuttavat muodot (yllapito, kaynnistamiskulu,
       * toimivaltafraasi, vuokra) tulevat luvun EDELLA, joten ikkuna
       * paattyy osumaan.
       */
      const at = match.index ?? 0
      const window = text.slice(Math.max(0, at - 220), at + match[0].length)
      if (SIDE_COST.test(window)) continue

      const raw = String(match[1] ?? "")
      const normalized =
        multiplier === 1 ? raw.replace(/[  .]/g, "") : raw.replace(",", ".")

      const value = Number(normalized)
      if (!Number.isFinite(value) || value <= 0) continue

      const euros = Math.round(value * multiplier)
      if (euros < min) continue
      if (euros > 3_000_000_000) continue

      return euros
    }
  }

  return null
}
