/*
 * ONKO RAKENTAMINEN JO ALKANUT?
 *
 * Vaihepäättely luki aiemmin pelkkää avainsanaa, ja mitattu 14.8.2026
 * osoitti ettei se riitä. Kolme kohdetta, kolme eri vikaa:
 *
 * *Rakennuslupa* oli heikoin. Kuudesta tarkistetusta osumasta yksi oli
 * oikein; muut olivat menneitä lupia ("Paviljongeille haettiin
 * määräaikainen rakennuslupa"), vasta haettavia ("haetaan
 * rakennuslupaa"), kustannuserittelyn rivejä ("suunnittelut
 * (rakennuslupa)") tai lomaketekstiä ("Jos rakennuslupahankkeesta
 * ilmenee huomautettavaa").
 *
 * *Kilpailutus* osui aikataululistaan: "urakkalaskenta ja
 * urakoitsijavalinnat 2-4/2027" on suunnitelma vuosien päähän, ei
 * nykytila.
 *
 * *Rakentaminen* oli paras mutta ei sekään yksin riittävä: "Oulun
 * elämysareenan rakentaminen alkaa suunnitelmien mukaan 2028" merkitsisi
 * hankkeen rakenteilla olevaksi neljä vuotta etuajassa.
 *
 * Siksi tekstistä päätellään vain rakentamisen alkaminen, ja vain kun
 * lauseen mainitsema ajankohta on jo mennyt. Ilman ajankohtaa lause
 * väittää asiaa nykyhetkestä ("rakennustyöt käynnistyvät Tampereella"),
 * jolloin se kelpaa sellaisenaan.
 */

const START_PHRASE =
  /(?:rakentaminen|rakennusty[öo]t|maanrakennusty[öo]t|ty[öo]maa|louhinta|perustusty[öo]t)\w*\s+(?:on\s+)?(?:alka|k[äa]ynnisty|alkoi|k[äa]ynnistyi|alkanut|k[äa]ynnistynyt)\w*/i

const MONTHS: [RegExp, number][] = [
  [/tammikuu/i, 1], [/helmikuu/i, 2], [/maaliskuu/i, 3], [/huhtikuu/i, 4],
  [/toukokuu/i, 5], [/kes[äa]kuu/i, 6], [/hein[äa]kuu/i, 7], [/elokuu/i, 8],
  [/syyskuu/i, 9], [/lokakuu/i, 10], [/marraskuu/i, 11], [/joulukuu/i, 12],
]

/*
 * Vuodenaika kartoitetaan sen AIKAISIMPAAN kuukauteen, päinvastoin kuin
 * valmistumisajassa. Kysymys on eri: siellä varmistetaan ettei hanketta
 * merkitä valmiiksi liian aikaisin, tässä ettei sitä merkitä alkaneeksi
 * liian aikaisin. Molemmissa virhe kallistuu varovaiseen suuntaan.
 */
const SEASONS: [RegExp, number][] = [
  [/alkuvuo/i, 1], [/kev[äa][äa]/i, 3], [/kes[äa]ll[äa]|kesäkaudella/i, 6],
  [/syksy/i, 9], [/loppuvuo/i, 10],
]

/* Ikkuna lauseen sisällä: ajankohta seuraa verbiä muutaman sanan päässä. */
const WINDOW = 90

export function constructionHasStarted(
  text: string | null | undefined,
  now: Date = new Date()
): boolean {
  const source = String(text ?? "")
  if (!source) return false

  const match = source.match(START_PHRASE)
  if (!match) return false

  const at = (match.index ?? 0) + match[0].length

  /*
   * IKKUNA KATKAISTAAN LAUSEENOSAAN.
   *
   * Mitattu tapaus: "Rakentaminen alkaa elokuussa ja valmista on vuonna
   * 2028." Ilman katkaisua vuosihaku poimi 2028:n, joka on
   * VALMISTUMISvuosi, ja sääntö päätteli rakentamisen alkavan kahden
   * vuoden päästä - juuri se rivi jonka piti korjaantua.
   *
   * Sivulause aloittaa uuden asian, joten aloitusajankohta on aina
   * ennen sitä.
   */
  const window = source
    .slice(at, at + WINDOW)
    .split(/[.;]|\s+(?:ja|sekä|mutta|jonka|joka)\s+/i)[0]

  const year = window.match(/\b(20\d{2})\b/)
  if (!year) {
    /*
     * Ei ajankohtaa: lause väittää asian nykyhetkestä. Tulevaisuuteen
     * viittaava sanamuoto ilman vuotta on silti este - "alkaa ensi
     * vuonna" ei kerro rakentamisen olevan käynnissä.
     */
    return !/ensi\s+vuonna|my[öo]hemmin|aikanaan|tulevaisuudessa/i.test(window)
  }

  const startYear = Number(year[1])
  const nowYear = now.getFullYear()

  if (startYear > nowYear) return false
  if (startYear < nowYear) return true

  /* Sama vuosi: kuukausi ratkaisee. */
  const before = window.slice(0, year.index ?? window.length)
  const month =
    MONTHS.find(([re]) => re.test(before))?.[1] ??
    SEASONS.find(([re]) => re.test(before))?.[1] ??
    null

  if (month === null) return true

  return month <= now.getMonth() + 1
}
