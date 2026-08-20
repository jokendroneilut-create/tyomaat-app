import { describe, it, expect } from "vitest"
import {
  cityFromHartelaHeading,
  projectNameFromHeadings,
} from "./fetchHartelaAreasSource"

describe("cityFromHartelaHeading", () => {
  /*
   * Otsikon järjestys vaihtelee sivulta toiselle. Pelkkä pilkkua edeltävä
   * osa antoi kunnan vain 7 sivulta 15:stä (mitattu 19.8.2026).
   */
  it("löytää kunnan otsikon kummalta puolelta tahansa", () => {
    expect(cityFromHartelaHeading("Kirkkonummi, Sarvvik")).toBe("Kirkkonummi")
    expect(cityFromHartelaHeading("Lauttasaari, Helsinki")).toBe("Helsinki")
  })

  /*
   * Lyhyet kunnat vaativat kaupunkitunnistimessa taivutuspäätteen, joten
   * pelkkä "Oulu" ei tunnistu. Otsikon osa on kuitenkin kokonaisuudessaan
   * kunnan nimi, joten suora vertailu kuntaluetteloon on turvallinen.
   */
  it("tunnistaa lyhyen kunnan ilman taivutuspäätettä", () => {
    expect(cityFromHartelaHeading("Oulu, Karjasillan Kulma")).toBe("Oulu")
  })

  it("tunnistaa taivutetun muodon ilman pilkkua", () => {
    expect(cityFromHartelaHeading("Nokian Keskusta")).toBe("Nokia")
  })

  it("palauttaa nullin kun kuntaa ei ole", () => {
    expect(cityFromHartelaHeading("Tulevat asuinalueet")).toBeNull()
  })
})

describe("projectNameFromHeadings", () => {
  /*
   * Sivun h1 on "Kirkkonummi, Sarvvik" eli kaupunki ja kaupunginosa — se ei
   * yksilöi hanketta. Taloyhtiön nimi on omana väliotsikkonaan.
   */
  it("käyttää taloyhtiön nimeä kun se löytyy", () => {
    expect(
      projectNameFromHeadings(
        ["Kaupunkikoti saaristomäntyjen kupeessa", "Asunto Oy Sarvvikin Ukonkello Kirkkonummi"],
        "Kirkkonummi, Sarvvik"
      )
    ).toBe("Asunto Oy Sarvvikin Ukonkello Kirkkonummi")
  })

  it("palaa otsikkoon kun taloyhtiötä ei mainita", () => {
    expect(
      projectNameFromHeadings(["Kolme syytä muuttaa Lentävänniemeen"], "Tampere, Lentävänniemi")
    ).toBe("Tampere, Lentävänniemi")
  })
})
