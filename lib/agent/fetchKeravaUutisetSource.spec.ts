import { describe, it, expect } from "vitest"
import { lapaiseeSuodatuksen, puhdistaTeksti } from "./fetchKeravaUutisetSource"

/*
 * Esimerkit ovat Keravan oikeita otsikoita 7.10.2026 mitatusta 127
 * jutun joukosta (D-247), eivat keksittyja. Yhdeksan ensimmaista
 * "lapaisee"-tapausta ovat juuri ne jotka edellinen, hanketermeihin
 * perustunut versio hylkasi vaarin perustein.
 */
describe("Keravan uutislahteen suodatin", () => {
  const lapaisee = [
    "Kauppakaaren kävelykadun suunnittelukilpailu on ratkennut",
    "Pihkaniityn omakotitontit myynnissä – tervetuloa tonttiesittelyyn",
    "Keravan kartanolle etsitään kilpailulla kehittäjää",
    "Räjäytystyöt maauimalan työmaalla jatkuvat",
    "Sompion päiväkodin uusi rakennus käyttöön helmikuussa 2025",
    "Hulevesijärjestelmän kunnostustyöt alkavat Jäspilän alueella",
    "Asfaltointi-, kivetys- ja vihertyöt alkavat Kaskelan alueella kesäkuun alussa",
    "Keravan kaupunki teettää maaperätutkimuksia Keinukalliontiellä",
    "Lentoradan alustava linjaus siirrettiin Keravan aseman tuntumaan",
    "Keravan skeittipuiston urakoitsija on valittu",
    "Taide- ja museokeskus Sinkan peruskorjaus käynnistyi",
  ]

  for (const title of lapaisee) {
    it(`paastaa lapi: ${title.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen({ title })).toBe(true)
    })
  }

  const hylataan = [
    "Äänestä nimeä Sompion skeittipaikalle",
    "Kehitä Killan aluetta vastaamalla kyselyyn",
    "Elävät Kaupunkikeskustat ry:n seminaari Keravalla 23.4.",
    "Rakentamislaki astuu voimaan 1.1.2025",
    "Yleinen arvonlisäverokanta nousee 25,5 prosenttiin 1.9.2024",
    "Keravan kaupungin rakennusjärjestys uudistuu",
    "Kaupungin karttapalvelussa käyttökatko 23.-29.8.",
    "Keravan kaupungin ja Itärata Oy:n yhteinen asukastilaisuus 11.2.",
  ]

  for (const title of hylataan) {
    it(`hylkaa: ${title.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen({ title })).toBe(false)
    })
  }

  /*
   * Poissulku katsoo VAIN otsikkoa (D-241). Jos leipatekstin maininta
   * kyselysta riittaisi hylkaamiseen, oikea hanke katoaisi silla
   * perusteella etta sen lopussa pyydetaan palautetta.
   */
  it("ei hylkaa hanketta leipatekstin kyselymaininnan takia", () => {
    expect(
      lapaiseeSuodatuksen({
        title: "Keskuskoulun peruskorjaus on jo lopputaipaleella",
      })
    ).toBe(true)
  })
})

describe("puhdistaTeksti", () => {
  /* Numeroentiteetti purkautuu oikeaksi merkiksi, ei katoa. */
  it("purkaa numeroentiteetin ajatusviivaksi", () => {
    expect(puhdistaTeksti("<p>Loitsutie 1 &#8211; asemakaavamuutos</p>")).toBe(
      "Loitsutie 1 – asemakaavamuutos"
    )
  })

  it("purkaa nimetyn entiteetin ja jattaa tuntemattoman rauhaan", () => {
    expect(puhdistaTeksti("Kerava &amp; Sipoo &tuntematon;")).toBe("Kerava & Sipoo &tuntematon;")
  })

  it("kutistaa valilyonnit yhdeksi", () => {
    expect(puhdistaTeksti("<p>a</p>\n\n   <p>b</p>")).toBe("a b")
  })
})
