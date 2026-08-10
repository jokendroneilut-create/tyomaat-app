import { describe, it, expect } from "vitest"
import { inferCompletionDateFromText, isPastDate } from "./inferCompletionDateFromText"

describe("inferCompletionDateFromText", () => {
  /*
   * Yritysten tiedotteiden aineistolla viritetyt kuviot. Nämä ovat tässä
   * siksi, että sopimuskauden lisäys ei saa muuttaa niiden tulosta -
   * uusi haara ajetaan vasta kun nämä eivät löydä mitään.
   */
  it("poimii kuukauden valmis-sanan läheltä", () => {
    expect(
      inferCompletionDateFromText("Urakka valmistuu kokonaisuudessaan syyskuussa 2025.")
    ).toBe("2025-09-30")
  })

  it("ei poimi kuukautta ilman valmis-sanaa", () => {
    expect(
      inferCompletionDateFromText("Sertifikaatti myönnettiin syyskuussa 2025.")
    ).toBeNull()
  })

  it("kartoittaa vuodenajan sen myöhäisimpään kuukauteen", () => {
    expect(
      inferCompletionDateFromText("Hankkeen arvioidaan valmistuvan loppuvuodesta 2025.")
    ).toBe("2025-12-31")
  })

  /*
   * Kunnan hankintapäätös ei sano "valmistuu syyskuussa" vaan ilmoittaa
   * sopimuskauden. Kauden loppu on se päivä johon mennessä työn on oltava
   * tehty. Mitattu rivi oli päätetty 5.12.2025 ja kausi päättyi 24.5.2026,
   * mutta se päätyi silti TIC-jonoon mahdollisuutena.
   */
  it("lukee valmistumisen sopimuskauden lopusta", () => {
    expect(
      inferCompletionDateFromText(
        "Keskusurheilukentän tekonurmen peruskorjaus. Hankinnan sopimuskausi " +
          "on 15.4.-24.5.2026."
      )
    ).toBe("2026-05-24")
  })

  it("lukee valmistumisen luovutuksen takarajasta", () => {
    expect(
      inferCompletionDateFromText(
        "Kohteen töiden tulee olla täysin valmiit ja luovutettavissa " +
          "tilaajalle viimeistään 31.5.2026."
      )
    ).toBe("2026-05-31")
  })

  /*
   * Aikavyöhyke ei saa siirtää päivää: toISOString() muuttaisi vuoden
   * ensimmäisen päivän edellisen vuoden viimeiseksi.
   */
  it("ei siirrä päivää aikavyöhykkeen verran", () => {
    expect(
      inferCompletionDateFromText("Hankinnan sopimuskausi on 1.1.2026 - 1.1.2027.")
    ).toBe("2027-01-01")
  })

  /* Tiedotteen oma valmistumislause voittaa, koska sopimuskausi on viimeisenä. */
  it("antaa valmis-lauseen voittaa sopimuskauden", () => {
    expect(
      inferCompletionDateFromText(
        "Urakka valmistuu maaliskuussa 2027. Hankinnan sopimuskausi on " +
          "1.5.2026 - 30.9.2026."
      )
    ).toBe("2027-03-31")
  })

  it("sietää tyhjän tekstin", () => {
    expect(inferCompletionDateFromText(null)).toBeNull()
    expect(inferCompletionDateFromText("")).toBeNull()
  })
})

describe("isPastDate", () => {
  it("tunnistaa menneen päivän", () => {
    expect(isPastDate("2020-01-01")).toBe(true)
  })

  it("ei pidä tulevaa päivää menneenä", () => {
    expect(isPastDate("2099-12-31")).toBe(false)
  })

  it("tyhjä ei ole mennyt", () => {
    expect(isPastDate(null)).toBe(false)
  })
})

describe("numeromuotoinen valmistumisaika", () => {
  /*
   * Kuntien hankesuunnitelmissa aikataulu kirjoitetaan lähes aina
   * numeroina, ei kuukauden nimellä. Mitattu: 52 päätösriviä, joista 39
   * oli jo mennyt - eli lähes 40 vuosia sitten valmistunutta hanketta
   * odotti katselmointijonossa merkinnällä "Suunnittelussa".
   */
  it("lukee muodon 'valmistuu 12 /2019'", () => {
    expect(
      inferCompletionDateFromText(
        "Aikataulu ja toteutus Rakentaminen alkaa 06 /19, ja työ valmistuu 12 /2019."
      )
    ).toBe("2019-12-31")
  })

  it("lukee muodon ilman välilyöntiä", () => {
    expect(inferCompletionDateFromText("Hanke valmistuu 9/2022.")).toBe("2022-09-30")
  })

  /*
   * Aloituspäivä on tyypillisesti samassa virkkeessä. Ilman
   * "valmis"-vartijaa kuvio poimisi sen ja hanke näyttäisi valmistuneen
   * ennen kuin se alkoi.
   */
  it("ei poimi pelkkää aloituspäivää", () => {
    expect(
      inferCompletionDateFromText("Rakentaminen alkaa 06/2019 ja kestää vuoden.")
    ).toBeNull()
  })

  /*
   * Kaksinumeroinen vuosi jäisi vuodeksi 19, koska päivän rakentaja lukee
   * luvun sellaisenaan. Vuosisadan arvaaminen olisi turhaa: mitatut
   * valmistumisajat kirjoitetaan aina nelinumeroisina.
   */
  it("ohittaa kaksinumeroisen vuoden", () => {
    expect(inferCompletionDateFromText("Työ valmistuu 12 /19.")).toBeNull()
  })
})
