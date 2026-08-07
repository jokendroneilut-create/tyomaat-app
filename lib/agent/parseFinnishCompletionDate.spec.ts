import { describe, it, expect } from "vitest"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"

describe("parseEstimatedCompletionDate", () => {
  it("poimii kuukauden ja vuoden", () => {
    expect(
      parseEstimatedCompletionDate("Kohteen arvioidaan valmistuvan lokakuussa 2026.")
    ).toBe("2026-10-31")
  })

  /*
   * Vuodenaika arvioidaan kauden VIIMEISEKSI kuukaudeksi, koska arviota
   * käytetään automaattiseen valmistuneeksi siirtoon - liian aikainen arvio
   * piilottaisi käynnissä olevan hankkeen asiakkailta.
   */
  it("arvioi vuodenajan myöhäisimpään kuukauteen", () => {
    expect(parseEstimatedCompletionDate("Kohde valmistuu keväällä 2027.")).toBe(
      "2027-05-31"
    )
  })

  it("poimii pelkän vuoden", () => {
    expect(
      parseEstimatedCompletionDate("Hankkeen valmistuminen vuonna 2028.")
    ).toBe("2028-12-31")
  })

  /*
   * Menneen aikamuodon on jäätävä ulkopuolelle. Mitattuna 4412 hankkeen
   * kuvauksista menneen muodon osumista EI YKSIKÄÄN koskenut hanketta itseään:
   * ne kertoivat purettavasta vanhasta rakennuksesta, valmistuneesta
   * kaavaselvityksestä tai naapurirakennuksesta.
   */
  it("ei poimi mennyttä aikamuotoa", () => {
    expect(
      parseEstimatedCompletionDate(
        "Puretaan vuonna 1987 valmistunut päärakennus."
      )
    ).toBeNull()
    expect(
      parseEstimatedCompletionDate("Yleissuunnitelma valmistui vuonna 2019.")
    ).toBeNull()
  })

  /*
   * Päivämäärän on oltava valmistumissanan lähellä, jottei tekstin muualla
   * mainittu aloituspäivä poimiudu valmistumiseksi.
   */
  it("ei poimi kaukana olevaa päivämäärää", () => {
    expect(
      parseEstimatedCompletionDate(
        "Kohde valmistuu aikanaan. Rakennustyöt käynnistyivät tammikuussa 2025 " +
          "ja alueella on tehty valmistelevia töitä jo pitkään."
      )
    ).toBeNull()
  })

  it("sietää tyhjän", () => {
    expect(parseEstimatedCompletionDate("")).toBeNull()
  })
})
