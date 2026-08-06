import { describe, it, expect } from "vitest"
import {
  canonicalOrganizationName,
  isSameOrganization,
} from "./organizationName"

describe("isSameOrganization", () => {
  /*
   * Mitattu tapaus: OYSin L-rakennus jäi yhdistämättä, koska rakennuttaja oli
   * kirjoitettu eri tavoin eikä same_developer osunut. Ilman sitä koko
   * täsmäytys palautti nullin - ehdokas ei saanut yhtään pistettä.
   */
  it("tunnistaa genetiivin ja sulkeet samaksi organisaatioksi", () => {
    expect(
      isSameOrganization(
        "Pohjois-Pohjanmaan hyvinvointialue Pohde",
        "Pohjois-Pohjanmaan hyvinvointialueen (Pohde)"
      )
    ).toBe(true)
  })

  it("sietää yhtiömuodon vaihtelun", () => {
    expect(isSameOrganization("Lujatalo Oy", "Lujatalo Oyj")).toBe(true)
    expect(isSameOrganization("Skanska Ab", "Skanska")).toBe(true)
  })

  it("sietää y-tunnuksen", () => {
    expect(
      isSameOrganization("Kuljetuspolar Oy", "Kuljetuspolar Oy (0195020-0)")
    ).toBe(true)
    expect(
      isSameOrganization("Pure Talotekniikka Oy (FI19367363)", "Pure Talotekniikka")
    ).toBe(true)
  })

  it("sietää sanajärjestyksen", () => {
    expect(isSameOrganization("Rakennus Oy Kallio", "Kallio Rakennus Oy")).toBe(true)
  })

  it("erottaa eri organisaatiot", () => {
    expect(isSameOrganization("Espoon kaupunki", "Espoon Asunnot Oy")).toBe(false)
    expect(isSameOrganization("Agomar Oy", "Nolite Oy")).toBe(false)
    expect(isSameOrganization("Lujatalo Oy", "Luja Oy")).toBe(false)
  })

  /*
   * -nen-loppuisia ei typistetä: "Virtanen" ei ole genetiivi, ja sen
   * purkaminen sekoittaisi eri yritykset.
   */
  it("ei typistä -nen-loppuisia nimiä", () => {
    expect(isSameOrganization("Virtanen Oy", "Virta Oy")).toBe(false)
    expect(canonicalOrganizationName("Virtanen Oy")).toBe("virtanen")
  })

  it("sietää tyhjät", () => {
    expect(isSameOrganization(null, "Lujatalo Oy")).toBe(false)
    expect(isSameOrganization("", "")).toBe(false)
    expect(canonicalOrganizationName("Oy")).toBeNull()
  })
})

describe("canonicalOrganizationName", () => {
  it("purkaa genetiivin", () => {
    expect(canonicalOrganizationName("Janakkalan kunta")).toBe("janakkala kunta")
    expect(canonicalOrganizationName("Pohjois-Pohjanmaan hyvinvointialueen")).toBe(
      "hyvinvointialue pohjanmaa pohjois"
    )
  })

  it("järjestää sanat, joten järjestys ei vaikuta", () => {
    expect(canonicalOrganizationName("Kallio Rakennus")).toBe(
      canonicalOrganizationName("Rakennus Kallio")
    )
  })
})
