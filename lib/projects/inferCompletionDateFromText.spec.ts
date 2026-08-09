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
