import { describe, it, expect } from "vitest"
import { chooseAdditionalInfo } from "./additionalInfo"

describe("chooseAdditionalInfo", () => {
  /*
   * Mitattu tapaus: Kouvolan yhtenaiskoulun lisatiedoissa luki
   * "rakentaminen kaynnistyy kevaalla 2026" vaikka hanke oli jo
   * rakenteilla. Uudempi teksti korvaa vanhentuneen.
   */
  it("korvaa vanhan tekstin uudemmalla", () => {
    const vanha = "Rakentamisen on tavoitteena kaynnistya kevaalla 2026. ".repeat(4)
    const uusi = "Rakentaminen on kaynnistynyt helmikuussa 2026 ja valmistuu 2028. ".repeat(4)
    expect(chooseAdditionalInfo(vanha, uusi)).toBe(uusi.trim())
  })

  /*
   * Osa tiedotteista on lyhyita nostoja. Niilla korvaaminen havittaisi
   * pitkan kuvauksen yksityiskohdat, joten romahdus estetaan.
   */
  it("ei korvaa pitkaa tekstia lyhyella nostolla", () => {
    const vanha = "Pitka kuvaus hankkeesta yksityiskohtineen. ".repeat(20)
    const uusi = "Lyhyt nosto."
    expect(chooseAdditionalInfo(vanha, uusi)).toBe(vanha.trim())
  })

  it("tayttaa tyhjan kentan", () => {
    expect(chooseAdditionalInfo(null, "Uusi teksti")).toBe("Uusi teksti")
    expect(chooseAdditionalInfo("", "Uusi teksti")).toBe("Uusi teksti")
  })

  it("sailyttaa vanhan kun uutta ei ole", () => {
    expect(chooseAdditionalInfo("Vanha teksti", null)).toBe("Vanha teksti")
    expect(chooseAdditionalInfo("Vanha teksti", "   ")).toBe("Vanha teksti")
  })

  it("kestaa kaksi tyhjaa", () => {
    expect(chooseAdditionalInfo(null, null)).toBeNull()
  })

  it("ei kirjoita samaa tekstia uudelleen", () => {
    expect(chooseAdditionalInfo("Sama", "Sama")).toBe("Sama")
  })
})
