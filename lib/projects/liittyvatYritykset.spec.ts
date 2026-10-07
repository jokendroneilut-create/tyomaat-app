import { describe, it, expect } from "vitest"
import { lisaaYritys, siivoaYritykset } from "./liittyvatYritykset"

describe("siivoaYritykset", () => {
  it("palauttaa tyhjan listan kun arvoa ei ole", () => {
    expect(siivoaYritykset(undefined)).toEqual([])
    expect(siivoaYritykset(null)).toEqual([])
    expect(siivoaYritykset("LOCI")).toEqual([])
  })

  it("poistaa tyhjat ja ei-merkkijonot mutta sailyttaa jarjestyksen", () => {
    expect(siivoaYritykset(["Sweco", "", null, 7, "  LOCI  "])).toEqual(["Sweco", "LOCI"])
  })
})

describe("lisaaYritys", () => {
  it("lisaa uuden nimen perään", () => {
    expect(lisaaYritys(["Sweco"], "LOCI Maisema-arkkitehdit")).toEqual([
      "Sweco",
      "LOCI Maisema-arkkitehdit",
    ])
  })

  it("ei lisaa samaa nimea kahdesti", () => {
    expect(lisaaYritys(["LOCI"], "LOCI")).toEqual(["LOCI"])
  })

  /*
   * Napin painaminen kahdesti tai lahteen eri kirjoitusasu ei saa
   * tuottaa asiakkaalle kahta riviä samasta yrityksesta.
   */
  it("ei lisaa samaa nimea eri kirjainkoossa", () => {
    expect(lisaaYritys(["LOCI Maisema-arkkitehdit"], "loci maisema-arkkitehdit")).toEqual([
      "LOCI Maisema-arkkitehdit",
    ])
  })

  it("sailyttaa ensin kirjatun kirjoitusasun", () => {
    expect(lisaaYritys(["LOCI Maisema-arkkitehdit"], "Loci Maisema-Arkkitehdit")[0]).toBe(
      "LOCI Maisema-arkkitehdit"
    )
  })

  it("jattaa listan rauhaan tyhjalla nimella", () => {
    expect(lisaaYritys(["Sweco"], "   ")).toEqual(["Sweco"])
  })

  it("siistii valilyonnit lisattavasta nimesta", () => {
    expect(lisaaYritys([], "  VSU maisema-arkkitehdit Oy  ")).toEqual([
      "VSU maisema-arkkitehdit Oy",
    ])
  })
})
