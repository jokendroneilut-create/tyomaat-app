import * as cheerio from "cheerio"

/*
 * VÄYLÄVIRASTON HANKESIVUN LEIPÄTEKSTI.
 *
 * Kollektori tallensi kuvaukseksi LISTAUSSIVUN teaserin, joka on tyypillisesti
 * yhden virkkeen mittainen:
 *
 *   "Lapin elinvoimakeskuksen päällystyskohteet kesällä 2026."   (56 merkkiä)
 *
 * Hankesivulla on sama teksti auki kirjoitettuna, ja siinä on juuri se tieto
 * jota urakoitsija tarvitsee — rahoitus, kilometrit ja KOHDELUETTELO
 * tienumeroineen, kunnittain ja pituuksineen:
 *
 *   "Vuonna 2026 Lapin elinvoimakeskukselle myönnettiin 23,8 miljoonaa euroa
 *    teiden päällystämiseen. Rahoituksella uusitaan päällystettä 145 km...
 *    Mt 926 Itäkoski–Suvannonvaara, Keminmaa-Tervola, n. 5 km
 *    Mt 934 Tapionkylä–Meltaus, Rovaniemi, n. 29 km..."          (2 500 merkkiä)
 *
 * Sivu haettiin jo yhteystietoa varten (D-103), joten tämä ei ole uusi
 * pyyntö vaan lisää kenttiä samasta vastauksesta.
 */

/*
 * Sisältölohko. Sivun muut `journal-content-article`-lohkot ovat
 * navigaatiota ja alatunnistetta ("Oikopolut", "Aiheesta muualla"), joten
 * ankkuri on nimenomaan tämä luokka.
 */
/*
 * KAKSI SIVUPOHJAA. Osalla hankkeista sisältö on `.project__intro`-lohkossa
 * ("Päällystystyöt Lapissa"), osalla `.content-article`-lohkossa
 * ("Vt 8 Rauma–Eurajoki"). Jälkimmäisessä on lisäksi hankkeen perustiedot,
 * aikataulu ja tilaaja.
 *
 * Mitattu 22.8.2026: pelkällä ensimmäisellä valitsimella 66 hanketta jäi
 * ilman kuvausta, vaikka sivulla oli 6 000 merkkiä tekstiä.
 */
const CONTENT_SELECTORS = [".project__intro", ".content-article"]

/*
 * Otsikon jäljessä olevat tilamerkinnät ("Tiehanke", "Käynnissä", "Lappi")
 * ovat samat tiedot jotka ovat jo omissa kentissään, joten ne eivät kuulu
 * kuvaukseen.
 */
const STATE_SELECTOR = ".project__intro__state"

/*
 * Alle 120 merkin tulos ei ole leipätekstiä vaan sama teaser uudelleen —
 * silloin ei kannata korvata mitään.
 */
const MIN_LENGTH = 120

export function parseVaylaDescription(html: string, title?: string | null): string | null {
  const $ = cheerio.load(html)

  /* Pisin tulos voittaa — sivupohja ratkeaa sisällön perusteella. */
  let puhdas = ""

  for (const selector of CONTENT_SELECTORS) {
    const lohko = $(selector).first()
    if (!lohko.length) continue

    lohko.find(STATE_SELECTOR).remove()
    lohko.find("script, style").remove()

    /*
     * Kappalejako säilytetään: kohdeluettelo on rivi per kohde, ja yhdeksi
     * möykyksi puristettuna se muuttuu lukukelvottomaksi.
     */
    const teksti = lohko
      .find("p, li, h2, h3, h4")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .join("\n")

    const ehdokas = (teksti || lohko.text().replace(/\s+/g, " ").trim()).trim()
    if (ehdokas.length > puhdas.length) puhdas = ehdokas
  }

  if (puhdas.length < MIN_LENGTH) return null

  /* Otsikko toistuu lohkon alussa — se on jo hankkeen nimessä. */
  const otsikko = String(title ?? "").trim()
  const ilmanOtsikkoa =
    otsikko && puhdas.startsWith(otsikko) ? puhdas.slice(otsikko.length).trim() : puhdas

  return ilmanOtsikkoa.length >= MIN_LENGTH ? ilmanOtsikkoa : puhdas
}
