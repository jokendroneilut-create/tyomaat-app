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

/*
 * JAVASCRIPTIN \w EI KATA SUOMEA (D-257).
 *
 * `\w` on [A-Za-z0-9_], joten se pysahtyy a:han ja o:hon. Osuma
 * "rakennustyot kaynnistyisivat" katkesi muotoon "...kaynnistyisiv", ja
 * ehtomuodon portti ei nahnyt paatetta -isivat lainkaan: suunniteltu
 * hanke meni lapi alkaneena. Vika loytyi kuivaharjoituksesta, ei
 * testeista.
 */
const SANAMERKKI = "[\\wäöåÄÖÅ]"
const SANARAJA = "(?![\\wäöåÄÖÅ])"
/*
 * SANAMUODOT ON MITATTU AINEISTOSTA, EI ARVATTU (D-257).
 *
 * Ensimmainen versio vaati ettei substantiivin ja verbin valissa ole
 * muuta kuin mahdollinen "on". Mitattu 8.10.2026: suomalainen tiedote
 * kirjoittaa lahes aina "ovat jo kaynnistyneet", "on nyt alkanut",
 * "ovat kaynnistyneet helmikuussa" — eli valissa on 1-2 sanaa. Lisaksi
 * puuttuivat sanat `maatyot`, `kaynnissa` ja `aloitettu`.
 *
 * Tasta jai 70 ehdokasta ja 10 hanketta suunnitteluvaiheeseen vaikka
 * teksti kertoi rakentamisen alkaneen.
 */
const ALOITUS_SUBSTANTIIVI =
  "rakentaminen|rakennusty[öo]t|maanrakennusty[öo]t|maaty[öo]t|ty[öo]maa|louhinta|perustusty[öo]t|kaivuuty[öo]t"

const ALOITUS_VERBI =
  "alka|k[äa]ynnisty|alkoi|k[äa]ynnistyi|alkanut|k[äa]ynnistynyt|k[äa]ynniss[äa]|aloitettu|meneill[äa][äa]n"

/*
 * Valiin sallitaan enintaan kaksi sanaa ("ovat jo"). Enempi alkaisi
 * yhdistaa eri lauseenosia toisiinsa.
 */
const START_PHRASE = new RegExp(
  `(?:${ALOITUS_SUBSTANTIIVI})${SANAMERKKI}*\\s+(?:${SANAMERKKI}+\\s+){0,2}?(?:${ALOITUS_VERBI})${SANAMERKKI}*`,
  "i"
)

/*
 * VALJEMPI HAHMO VAATII OMAN PORTIN.
 *
 * Kahden sanan vali paastaa lapi kieltomuodon ja aikomuksen:
 * "rakentaminen EI OLE alkanut", "rakentaminen PAASEE kaynnistymaan",
 * "rakentamisen ON MAARA alkaa". Kaikki kolme esiintyvat aineistossa.
 * Osuma hylataan jos valissa on jokin naista.
 */
/*
 * EHTOMUOTO ON SUUNNITELMA, EI TAPAHTUMA (D-257).
 *
 * Kuivaharjoitus 8.10.2026 paljasti kolme vaaraa osumaa, kaikki samaa
 * lajia:
 *
 *   "rakentaminen voi alkaa viimeistaan alkuvuonna"
 *   "rakennustyot voisivat kaynnistya kesalla 2021"
 *   "kerrostalon rakentaminen kaynnistyisi vuoden 2026 aikana"
 *
 * Kaksi ensimmaista paasi lapi vasta kun valiin sallittiin kaksi
 * sanaa; kolmas oli vanha vika jota kukaan ei ollut huomannut.
 *
 * VUOSITARKISTUS EI PELASTA TASTA: "voisivat kaynnistya kesalla 2021"
 * on MENNYT vuosi, joten sana "voisivat" on ainoa ero tapahtuneen ja
 * suunnitellun valilla.
 */
const EHTOMUOTO = new RegExp(
  `${SANAMERKKI}+isi(?:vat|vät)?${SANARAJA}|\\bvoi\\b|\\bvoitaisiin\\b|\\bsaattaa\\b`,
  "i"
)

const EI_VIELA = /\b(?:ei|eiv[äa]t|p[äa][äa]se\w*|m[äa][äa]r[äa]|tarkoitus|aikoo|suunnitel\w*|toivottavasti)\b/i

/*
 * "edennyt" jatettiin tahallaan pois: aineistossa on "hankkeen
 * rakentaminen on EDENNYT SUUNNITTELUSSA aikataulussa", joka tarkoittaa
 * paivastoin etta rakentaminen ei ole alkanut. Myos "Tyomaa on edennyt
 * aikataulussa" jaa siksi tunnistamatta — tiedostettu aukko, ja
 * vaarin merkitty vaihe nakyy asiakkaalle.
 */

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
  if (EI_VIELA.test(match[0])) return false
  if (EHTOMUOTO.test(match[0])) return false

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
    /*
     * "rakentaminen alkaa siita, etta etsimme tontin" on
     * markkinointitekstin MAARITELMA yrityksen tavasta toimia, ei
     * vaite tasta hankkeesta. Mitattu kuivaharjoituksessa 8.10.2026.
     */
    return !/ensi\s+vuonna|my[öo]hemmin|aikanaan|tulevaisuudessa|^\s*siit[äa]\s*,?\s*ett[äa]/i.test(window)
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
