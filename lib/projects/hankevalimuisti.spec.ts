import { describe, expect, it } from "vitest"

import { kelpaakoMerkinta } from "./hankevalimuisti"

const TUNTI = 60 * 60 * 1000
const NYT = 1_800_000_000_000

describe("kelpaakoMerkinta", () => {
  it("hyvaksyy tuoreen merkinnan jossa on rivejä", () => {
    expect(kelpaakoMerkinta({ rivit: [{ id: "a" }], tallennettu: NYT - TUNTI }, NYT)).toBe(true)
  })

  /*
   * Taman takia koko korjaus tehtiin: tyhja merkinta nayttäisi
   * asiakkaalle tyhjaa karttaa kaksi tuntia ilman virheilmoitusta.
   */
  it("hylkaa tyhjan merkinnan vaikka se olisi tuore", () => {
    expect(kelpaakoMerkinta({ rivit: [], tallennettu: NYT }, NYT)).toBe(false)
  })

  it("hylkaa yli kahden tunnin ikaisen", () => {
    expect(kelpaakoMerkinta({ rivit: [{ id: "a" }], tallennettu: NYT - 3 * TUNTI }, NYT)).toBe(false)
  })

  /* Kello on voinut siirtya taaksepain; tulevaisuuden aikaleima ei kelpaa. */
  it("hylkaa tulevaisuuteen leimatun", () => {
    expect(kelpaakoMerkinta({ rivit: [{ id: "a" }], tallennettu: NYT + TUNTI }, NYT)).toBe(false)
  })

  it("hylkaa rikkinaisen rakenteen", () => {
    expect(kelpaakoMerkinta(null, NYT)).toBe(false)
    expect(kelpaakoMerkinta({ rivit: "ei taulukko", tallennettu: NYT }, NYT)).toBe(false)
    expect(kelpaakoMerkinta({ rivit: [{ id: "a" }] }, NYT)).toBe(false)
  })

  it("hyvaksyy tasan rajalla olevan", () => {
    expect(kelpaakoMerkinta({ rivit: [{ id: "a" }], tallennettu: NYT - 2 * TUNTI }, NYT)).toBe(true)
  })
})
