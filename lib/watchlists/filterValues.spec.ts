import { describe, expect, it } from "vitest"

import { describeFilter, filterValues } from "./filterValues"

describe("filterValues", () => {
  it("lukee vanhan yksittaisen merkkijonon", () => {
    expect(filterValues("Uusimaa")).toEqual(["Uusimaa"])
  })

  it("lukee monivalinnan listan", () => {
    expect(filterValues(["Uusimaa", "Pirkanmaa"])).toEqual(["Uusimaa", "Pirkanmaa"])
  })

  /*
   * Tyhja lista on JavaScriptissa tosi, joten se on juuri se tapaus
   * jonka pelkka totuusarvotarkistus paastaisi lapi.
   */
  it("kohtelee tyhjaa listaa rajaamattomana", () => {
    expect(filterValues([])).toEqual([])
  })

  it("kohtelee tyhjaa merkkijonoa rajaamattomana", () => {
    expect(filterValues("")).toEqual([])
  })

  it("kestaa nullin ja roskan", () => {
    expect(filterValues(null)).toEqual([])
    expect(filterValues(undefined)).toEqual([])
    expect(filterValues(42)).toEqual([])
  })

  /* Listaan voi kannassa olla eksynyt muutakin kuin merkkijonoja. */
  it("pudottaa listasta tyhjat ja vaarat tyypit", () => {
    expect(filterValues(["Uusimaa", "", null, 3, "Lappi"])).toEqual(["Uusimaa", "Lappi"])
  })
})

describe("describeFilter", () => {
  it("kokoaa monivalinnan yhdelle riville", () => {
    expect(describeFilter("Maakunta", ["Uusimaa", "Pirkanmaa"])).toBe("Maakunta: Uusimaa, Pirkanmaa")
  })

  it("nayttaa vanhan yksittaisvalinnan ennallaan", () => {
    expect(describeFilter("Maakunta", "Uusimaa")).toBe("Maakunta: Uusimaa")
  })

  /* Ilman tata yhteenvetoon tulisi "Maakunta: " ilman arvoa. */
  it("jattaa tyhjan rajauksen pois", () => {
    expect(describeFilter("Maakunta", [])).toBeNull()
    expect(describeFilter("Maakunta", null)).toBeNull()
  })
})
