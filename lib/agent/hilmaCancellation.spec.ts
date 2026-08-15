import { describe, it, expect } from "vitest"
import { isCancellationNotice, titleSaysCancellation } from "./hilmaCancellation"

describe("isCancellationNotice", () => {
  /*
   * Kaikki mitatut otsikkomuodot 15.8.2026 (11 rivia kannassa).
   */
  it("tunnistaa mitatut otsikkomuodot", () => {
    const titles = [
      "Keskeytysilmoitus, TAPO Köyliöntien tasoristeysturvallisuuden parantaminen RU",
      "Keskeytysilmoitus: Pori-Mäntyluoto-Tahkoluoto, tasoristeysturvallisuuden parantaminen",
      "Keskeytys-ilmoitus-Olavinlinnan kuparikatteiden korjaushanke",
      "KESKEYTYS: Vuosaaren Urheilutalo, allashallin korjaustyöt 2026, vedenkäsittely",
      "JÄLKI-ILMOITUS HANKINNAN KESKEYTTÄMINEN_Kokkokankaan koulun ilmanvaihdon saneeraus",
    ]

    for (const title of titles) {
      expect(
        isCancellationNotice({ title, winners: [], winnerOrganisations: null })
      ).toBe(true)
    }
  })

  /*
   * VOITTAJA KUMOAA. Jos ilmoitus keskeyttaa yhden osan ja myontaa
   * toisen, hanketta ei saa palauttaa kilpailutukseen.
   */
  it("ei tunnista keskeytykseksi jos voittaja on merkitty", () => {
    expect(
      isCancellationNotice({
        title: "Keskeytysilmoitus: Matkaparkin rakentaminen",
        winners: ["Rakennus Oy"],
        winnerOrganisations: null,
      })
    ).toBe(false)

    expect(
      isCancellationNotice({
        title: "Keskeytysilmoitus: Matkaparkin rakentaminen",
        winners: [],
        winnerOrganisations: "Rakennus Oy",
      })
    ).toBe(false)
  })

  /*
   * Tavallinen sopimusilmoitus ilman voittajaa ei ole keskeytys -
   * mitattu 45 tallaista rivia, joista vain 10 oli keskeytyksia.
   */
  it("ei tunnista tavallista sopimusilmoitusta keskeytykseksi", () => {
    expect(
      isCancellationNotice({
        title: "Köyliöntien tasoristeysturvallisuuden parantaminen RU",
        winners: [],
        winnerOrganisations: null,
      })
    ).toBe(false)
  })

  /*
   * "keskeytetty" hankkeen kuvauksessa ei kerro taman ilmoituksen
   * luonteesta.
   */
  it("ei osu sanaan keskeytetty muualla tekstissa", () => {
    expect(titleSaysCancellation("Koulun laajennus, aiempi hanke keskeytettiin 2019")).toBe(false)
  })

  it("sietaa tyhjan", () => {
    expect(isCancellationNotice({ title: null })).toBe(false)
    expect(isCancellationNotice({ title: "" })).toBe(false)
  })
})
