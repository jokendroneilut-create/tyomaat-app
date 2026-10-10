import { describe, it, expect } from "vitest"
import { palautaHylattyJonoon } from "./palautaHylatty"

describe("palautaHylattyJonoon", () => {
  it("palauttaa kun hylatylle tulee voittaja", () => {
    expect(palautaHylattyJonoon({ status: "rejected", metadata: {} }, { winners: ["Lujatalo Oy"] })).toBe(true)
    expect(
      palautaHylattyJonoon({ status: "rejected", metadata: {} }, { winner_organisations: "Helmark Interior Oy" })
    ).toBe(true)
  })

  /* Vain hylatyt. Hyvaksytty paivittyy omaa polkuaan, uusi on jo jonossa. */
  for (const tila of ["new", "approved", "ignored"]) {
    it(`ei kosketa tilaan ${tila}`, () => {
      expect(palautaHylattyJonoon({ status: tila, metadata: {} }, { winners: ["X Oy"] })).toBe(false)
    })
  }

  /*
   * Sopimusilmoitus ilman voittajaa on usein keskeytys (D-251), ei syy
   * palauttaa rivia.
   */
  it("ei palauta pelkasta sopimusilmoituksesta ilman voittajaa", () => {
    expect(palautaHylattyJonoon({ status: "rejected", metadata: {} }, { is_contract_award: true, winners: [] })).toBe(false)
  })

  it("ei palauta jos voittaja oli jo tiedossa hylattaessa", () => {
    expect(
      palautaHylattyJonoon(
        { status: "rejected", metadata: { winner_organisations: "Vanha Oy" } },
        { winners: ["Uusi Oy"] }
      )
    ).toBe(false)
  })

  it("tyhja ja roskasyote eivat palauta", () => {
    expect(palautaHylattyJonoon({ status: "rejected", metadata: {} }, null)).toBe(false)
    expect(palautaHylattyJonoon({ status: "rejected", metadata: {} }, { winners: ["", "  "] })).toBe(false)
  })
})
