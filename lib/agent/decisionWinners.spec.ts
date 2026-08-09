import { describe, it, expect } from "vitest"
import { extractDecisionWinners } from "./decisionWinners"

/*
 * Katkelmat ovat oikeista päätösteksteistä. Jokainen mittaa yhtä
 * päätöslausemuotoa, ja mukana on aina se tarjoajaluettelo joka
 * ensimmäisessä versiossa vuoti voittajiin.
 */

/* 1. Monikkorooli + luettelo: puitesopimus, kaikki listatut voittavat. */
const PUITESOPIMUS =
  "Määräaikaan mennessä saatiin tarjouksia 9 yritykseltä. " +
  "AS-Corp Oy:n (y-tunnus 3494831-8) tarjous hylätään. Tarjouspyynnössä oli " +
  "edellytetty, että tarjoajalla on tekniset edellytykset. " +
  "Kaupunginhallitus päättää hyväksyä puitesopimuskumppaneiksi seuraavat tarjoajat: " +
  "Ahosen Palvelut Oy (1742476-6) Homex Oy (3223566-4) " +
  "J&S Kymäläinen Oy (2734092-9) Karri Räikkä Oy (2272821-1) " +
  "Kuusaan Muonituspalvelu Ay (FI15225253) MM Infra Oy (0671339-4) " +
  "Purkupiha Oy (1868810-6) Terra Infra Oy (1647729-2)"

/*
 * 2. Yksikkörooli. Tarjoajaluettelo on ennen päätöslausetta, ja Lujatalo
 * ja Lapti eivät tule hylätyiksi - ne vain häviävät vertailun. Juuri tämä
 * kaatoi y-tunnukseen ankkuroidun poiminnan.
 */
const YKSI_URAKOITSIJA =
  "Tarjoajiksi valittiin seuraavat kolme (3) ehdokasta: Lujatalo Oy " +
  "(0177307-8), Rakennusliike Lapti Oy (2054752-4) ja Varte Lahti Oy " +
  "(2755434-5). Kaikki tarjoajat täyttävät tarjouspyynnön ehdot. " +
  "Esitetään, että Kuusankosken yhtenäiskoulun KVR-urakoitsijaksi valitaan " +
  "Varte Lahti Oy käyttäen Varte Lappeenranta Oy:n ja Varte Oy:n voimavaroja."

/* 3. Viranhaltijapäätöksen vakiolause hintavertailun jälkeen. */
const VIRANHALTIJA =
  "Tarjousvertailuun hyväksytään kaikki tarjouksen jättäneet. Kaikki hinnat " +
  "(ALV 0 %) Tarjoaja Urakkahinta 1. Saltex Infra Oy 1 650 000,00 € " +
  "2. Recset Oy 1 833 440,00 € 3. Spesifix oy 1 911 000,00 € " +
  "Päätös Valitsen Saltex Infra Oy:n hinnaltaan halvimpana."

/* 4. Ablatiivi: hankinnan kohde ostetaan nimetyltä yritykseltä. */
const ABLATIIVI =
  "Hyväksytyt tarjoajat (Y-tunnus) ja heidän urakkahintansa olivat: " +
  "Oteran Oy (2245597-0) 833 500 euroa Silta Laksio Oy (22548122) 967 000 euroa " +
  "GRK Suomi Oy (2810844-3) 1 049 000 euroa. " +
  "Tekninen lautakunta päättää, että Kouvolan kaupunki hankkii Puhjon " +
  "risteyssilta (W) korjausurakka, 2026 (KU) - urakan Oteran Oy:ltä."

describe("extractDecisionWinners", () => {
  it("poimii puitesopimuskumppanit luettelosta", () => {
    expect(extractDecisionWinners(PUITESOPIMUS)).toEqual([
      "Ahosen Palvelut Oy",
      "Homex Oy",
      "J&S Kymäläinen Oy",
      "Karri Räikkä Oy",
      "Kuusaan Muonituspalvelu Ay",
      "MM Infra Oy",
      "Purkupiha Oy",
      "Terra Infra Oy",
    ])
  })

  it("jättää hylätyn tarjoajan pois luettelosta", () => {
    expect(extractDecisionWinners(PUITESOPIMUS)).not.toContain("AS-Corp Oy")
  })

  /*
   * Ääkköset: \w ei kata niitä, ja ilman erillistä luetteloa nimi katkeaa
   * ä:hän. Mitattu puute ennen korjausta.
   */
  it("poimii nimet joissa on ääkkösiä tai &-merkki", () => {
    const w = extractDecisionWinners(PUITESOPIMUS)
    expect(w).toContain("Karri Räikkä Oy")
    expect(w).toContain("J&S Kymäläinen Oy")
  })

  it("poimii yksikköroolista vain valitun, ei hävinneitä tarjoajia", () => {
    expect(extractDecisionWinners(YKSI_URAKOITSIJA)).toEqual(["Varte Lahti Oy"])
  })

  it("poimii viranhaltijan valinnan eikä hintavertailun rivejä", () => {
    expect(extractDecisionWinners(VIRANHALTIJA)).toEqual(["Saltex Infra Oy"])
  })

  it("poimii ablatiivimuodon eikä hyväksyttyjen tarjoajien taulukkoa", () => {
    expect(extractDecisionWinners(ABLATIIVI)).toEqual(["Oteran Oy"])
  })

  /*
   * "Tarjoajiksi valittiin" on monikkorooli mutta ei voittajarooli.
   * Ilman roolisanaston rajausta tämä olisi tuottanut koko tarjoajalistan.
   */
  it("ei pidä tarjoajaksi valitsemista voittona", () => {
    expect(
      extractDecisionWinners(
        "Tarjoajiksi valittiin seuraavat kolme (3) ehdokasta: Lujatalo Oy " +
          "(0177307-8), Rakennusliike Lapti Oy (2054752-4)."
      )
    ).toEqual([])
  })

  /*
   * Sopimuskumppani ei ole urakan voittaja. Näissä päätöksissä kaupunki
   * sopii toisen osapuolen kanssa korvauksesta - urakkaa ei ole kilpailutettu.
   */
  it("ei poimi sopimuksen osapuolta voittajaksi", () => {
    expect(
      extractDecisionWinners(
        "Päätös Tonttipäällikkö päätti tehdä Helsinki Shipyard Oy:n " +
          "(y-tunnus 2999898-6) kanssa liitteen 1 mukaisen sopimuksen, joka " +
          "koskee Hietalahden telakka-altaan pilaantuneita sedimenttejä."
      )
    ).toEqual([])
  })

  /* Ablatiivi ilman ostoverbiä on lausunnonantaja, ei toimittaja. */
  it("ei poimi lausunnonantajaa ablatiivista", () => {
    expect(
      extractDecisionWinners("Asiasta pyydettiin lausunto Ramboll Finland Oy:ltä.")
    ).toEqual([])
  })

  /*
   * Viides lausemuoto: monikkorooli mutta yksi voittaja, ja verbin ja nimen
   * välissä on perustelu. Roolin luku ei siis kerro voittajien määrää.
   */
  it("poimii voittajan kun verbin ja nimen välissä on perustelu", () => {
    expect(
      extractDecisionWinners(
        "Päätän, että edellä mainituilla perusteilla Sipolantien 9 " +
          "purku-urakkahankinnan sopimustoimittajiksi valitaan hinnaltaan " +
          "halvimman kokonaistarjouksen jättänyt Lapin Timanttisahaus Oy, " +
          "jonka kokonaishinta on 16 500,00 € alv 0 %."
      )
    ).toEqual(["Lapin Timanttisahaus Oy"])
  })

  /*
   * Perustelusanat EIVÄT saa päätyä nimeen. Kuvio ei siksi voi käyttää
   * i-lippua: se tekisi myös nimen kuviosta [A-ZÅÄÖ] kirjainkoosta
   * riippumattoman. Mitattu: kantaan päätyi voittajaksi
   * "kokonaistaloudellisesti edullisimman tarjouksen jättänyt Oteran Oy".
   */
  it("ei liitä perustelusanoja yrityksen nimeen", () => {
    expect(
      extractDecisionWinners(
        "Kaupunkikehityslautakunta päätti, että Aleksanterinkadun sillan " +
          "perusparantamisen urakoitsijaksi valitaan kokonaistaloudellisesti " +
          "edullisimman tarjouksen jättänyt Oteran Oy."
      )
    ).toEqual(["Oteran Oy"])
  })

  /*
   * Ilman verbiä nimen on seurattava roolia heti. Muuten kuvio poimisi
   * minkä tahansa lähellä olevan yrityksen.
   */
  it("ei hyppää roolista kaukaiseen yritykseen ilman valintaverbiä", () => {
    expect(
      extractDecisionWinners(
        "Urakoitsijaksi soveltuvan yrityksen tulee täyttää tarjouspyynnön " +
          "ehdot. Tarjouksen jätti Rakennus Oy."
      )
    ).toEqual([])
  })

  it("ei toista samaa yritystä kahdesti", () => {
    expect(extractDecisionWinners(`${PUITESOPIMUS} Päätös: ${PUITESOPIMUS}`)).toHaveLength(8)
  })

  it("sietää tyhjän kuvauksen", () => {
    expect(extractDecisionWinners(null)).toEqual([])
    expect(extractDecisionWinners("")).toEqual([])
  })
})
