import { describe, expect, it } from "vitest"
import { cpvKoodit, estettyPerhe } from "./hilmaRakentamisenIlmoitus"

describe("cpvKoodit", () => {
  it("lukee taulukon", () => {
    expect(cpvKoodit(["45000000", "45211000"])).toEqual(["45000000", "45211000"])
  })

  it("lukee valilyonnein erotellun merkkijonon", () => {
    expect(cpvKoodit("85121270 85000000")).toEqual(["85121270", "85000000"])
  })

  it("lukee olion code-kentan", () => {
    expect(cpvKoodit([{ code: "45000000" }])).toEqual(["45000000"])
  })

  it("tyhja syote antaa tyhjan listan", () => {
    expect(cpvKoodit(null)).toEqual([])
    expect(cpvKoodit("")).toEqual([])
  })
})

describe("estettyPerhe", () => {
  it("estaa Kelan avoterapian", () => {
    expect(estettyPerhe("85000000")).toBe("85")
    expect(estettyPerhe(["85121270", "85000000"])).toBe("85")
  })

  it("estaa muut nollan hyvaksynnan perheet", () => {
    expect(estettyPerhe("79210000")).toBe("79")
    expect(estettyPerhe("60100000")).toBe("60")
    expect(estettyPerhe("38510000")).toBe("38")
  })

  it("paastaa rakennusurakan", () => {
    expect(estettyPerhe("45211000")).toBeNull()
  })

  it("45 kumoaa eston: sairaalan uudisrakennus", () => {
    expect(estettyPerhe("85000000 45215100")).toBeNull()
  })

  it("paastaa suunnittelu-urakan vaikka 45 puuttuu", () => {
    expect(estettyPerhe("71240000")).toBeNull()
    expect(estettyPerhe(["71000000", "71520000"])).toBeNull()
  })

  it("paastaa perheen josta on tullut hyvaksytty hanke", () => {
    expect(estettyPerhe("50700000")).toBeNull()
    expect(estettyPerhe("33100000")).toBeNull()
    expect(estettyPerhe("72250000")).toBeNull()
  })

  it("sekalainen lista paasee lapi jos yksikin perhe on sallittu", () => {
    expect(estettyPerhe("85141000 71240000")).toBeNull()
  })

  it("ilman koodia otetaan mukaan", () => {
    expect(estettyPerhe(null)).toBeNull()
    expect(estettyPerhe([])).toBeNull()
  })
})
