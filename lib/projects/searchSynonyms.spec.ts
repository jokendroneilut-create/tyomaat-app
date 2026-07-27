import { describe, it, expect } from "vitest"
import { expandSearchTerm } from "./searchSynonyms"

describe("expandSearchTerm", () => {
  it("laajentaa konesalin datakeskuksen synonyymeiksi", () => {
    const expanded = expandSearchTerm("konesali")
    expect(expanded).toContain("datakeskus")
    expect(expanded).toContain("konesali")
  })

  it("laajentaa terveyskeskuksen sairaalaksi ja päinvastoin", () => {
    expect(expandSearchTerm("terveyskeskus")).toContain("sairaala")
    expect(expandSearchTerm("sairaala")).toContain("terveyskeskus")
  })

  it("laajentaa tuotantolaitoksen tehtaaksi", () => {
    expect(expandSearchTerm("tuotantolaitos")).toContain("tehdas")
  })

  it("ei laajenna lyhyttä (< 4) hakusanaa", () => {
    expect(expandSearchTerm("dat")).toEqual(["dat"])
  })

  it("palauttaa termin itsensä myös ilman synonyymejä", () => {
    expect(expandSearchTerm("forssa")).toEqual(["forssa"])
  })
})
