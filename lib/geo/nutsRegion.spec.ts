import { describe, expect, it } from "vitest"

import { maakuntaNutsKoodista, NUTS_MAAKUNNAT } from "./nutsRegion"
import { MUNICIPALITIES } from "./municipalities"

describe("maakuntaNutsKoodista", () => {
  it("kaantaa yksittaisen koodin", () => {
    /* Fingridin Ivalon sahkoasema kantoi tata koodia (D-292). */
    expect(maakuntaNutsKoodista("FI1D7")).toBe("Lappi")
    expect(maakuntaNutsKoodista("FI1B1")).toBe("Uusimaa")
  })

  it("EI kaanna paljasta FI-koodia", () => {
    /*
     * Mitattu: koodilla "FI" oli 134 aanta jotka jakautuivat 16 eri
     * maakuntaan. Se tarkoittaa koko Suomea.
     */
    expect(maakuntaNutsKoodista("FI")).toBeNull()
  })

  it("EI kaanna ulkomaista koodia", () => {
    /* ITH35 on Venetsia (Pohjoismaiden paviljonki). */
    expect(maakuntaNutsKoodista("ITH35")).toBeNull()
    expect(maakuntaNutsKoodista("SE110")).toBeNull()
  })

  it("hyvaksyy useita koodeja jos ne ovat samasta maakunnasta", () => {
    expect(maakuntaNutsKoodista("FI1D7 FI1D7")).toBe("Lappi")
  })

  it("jattaa monialuehankkeen tyhjaksi", () => {
    /* Voimajohto kahden maakunnan lapi: puolet olisi vaara vastaus. */
    expect(maakuntaNutsKoodista("FI1D7 FI1D9")).toBeNull()
  })

  it("tuntematon koodi on este, ei ohitettava", () => {
    /*
     * Jos "FI" sivuutettaisiin, "FI FI1D7" nayttaisi yksialueiselta
     * vaikka ilmoitus kattaa koko maan.
     */
    expect(maakuntaNutsKoodista("FI FI1D7")).toBeNull()
  })

  it("sietaa tyhjat ja kelvottomat syotteet", () => {
    expect(maakuntaNutsKoodista(null)).toBeNull()
    expect(maakuntaNutsKoodista("")).toBeNull()
    expect(maakuntaNutsKoodista("   ")).toBeNull()
  })

  it("kirjainkoko ei haittaa", () => {
    expect(maakuntaNutsKoodista("fi1d7")).toBe("Lappi")
  })

  /*
   * TARKEIN TESTI: maakunnan nimen on oltava TASMALLEEN sama kuin
   * kuntarekisterissa. Muuten sama maakunta esiintyy kahdella
   * kirjoitusasulla ja hakuvahti loytaa vain toisen.
   */
  it("maakuntien nimet tasmaavat kuntarekisteriin", () => {
    const rekisterin = new Set(
      Object.values(MUNICIPALITIES)
        .map((m) => m.region)
        .filter((r): r is string => Boolean(r))
    )
    const tuntemattomat = [...new Set(Object.values(NUTS_MAAKUNNAT))].filter(
      (nimi) => !rekisterin.has(nimi)
    )
    expect(tuntemattomat).toEqual([])
  })

  it("kartassa on 18 mitattua koodia", () => {
    /* Kynnys oli >= 3 aanta ja >= 90 % yksimielisyys. */
    expect(Object.keys(NUTS_MAAKUNNAT)).toHaveLength(18)
  })
})
