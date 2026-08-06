import { describe, it, expect } from "vitest"
import { resolveWinnerName } from "./winnerName"

describe("resolveWinnerName", () => {
  /*
   * Ydinvirhe jonka takia tämä on olemassa: winner_organisations on
   * merkkijono, joten [0] palautti ensimmäisen kirjaimen. Mitattu tapaus:
   * "Maanrakennusurakka 4 2026 Käpykatu" sai pääurakoitsijaksi "K".
   */
  it("ei koskaan palauta yksittäistä kirjainta merkkijonosta", () => {
    const result = resolveWinnerName({
      winner_organisations: "Kuljetuspolar Oy",
    })
    expect(result).toBe("Kuljetuspolar Oy")
    expect(result).not.toBe("K")
  })

  it("suosii pilkottua winners-taulukkoa", () => {
    expect(
      resolveWinnerName({
        winners: ["Kuljetuspolar Oy"],
        winner_organisations: "Kuljetuspolar Oy",
      })
    ).toBe("Kuljetuspolar Oy")
  })

  it("yhdistää useamman voittajan", () => {
    expect(resolveWinnerName({ winners: ["A Oy", "B Oy"] })).toBe("A Oy, B Oy")
  })

  it("putoaa merkkijonoon kun taulukko on tyhjä", () => {
    expect(
      resolveWinnerName({ winners: [], winner_organisations: "Lujatalo Oy" })
    ).toBe("Lujatalo Oy")
  })

  it("sietää taulukkomuotoisen winner_organisationsin", () => {
    expect(resolveWinnerName({ winner_organisations: ["YIT Oyj"] })).toBe("YIT Oyj")
  })

  it("siivoaa tyhjät ja välilyönnit", () => {
    expect(resolveWinnerName({ winners: ["  ", "Peab Oy", null] })).toBe("Peab Oy")
    expect(resolveWinnerName({ winner_organisations: "   " })).toBeNull()
  })

  it("palauttaa null kun voittajaa ei ole", () => {
    expect(resolveWinnerName({})).toBeNull()
    expect(resolveWinnerName(null)).toBeNull()
    expect(resolveWinnerName({ winners: [] })).toBeNull()
  })
})
