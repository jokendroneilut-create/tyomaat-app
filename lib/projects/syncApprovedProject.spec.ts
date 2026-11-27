import { describe, expect, it } from "vitest"
import { yhdistaMetatiedot } from "./syncApprovedProject"

describe("yhdistaMetatiedot (D-456)", () => {
  it("ei anna tyhjän arvon pyyhkiä olemassa olevaa", () => {
    const hanke = { description: "Hotelli Mesikämmenen suojelumääräysten tarkistus.", contact_persons: [{ name: "A" }], developer: "X Oy" }
    const uusi = { description: null, contact_persons: [], developer: "  ", phase_hint: "Kaavoitus" }
    expect(yhdistaMetatiedot(hanke, uusi)).toEqual({ ...hanke, phase_hint: "Kaavoitus" })
  })

  it("antaa uuden ei-tyhjän arvon voittaa", () => {
    expect(yhdistaMetatiedot({ description: "vanha", n: 1 }, { description: "uusi", n: 0 })).toEqual({ description: "uusi", n: 0 })
  })

  it("kirjoittaa tyhjän, kun vanhaa ei ole", () => {
    expect(yhdistaMetatiedot({}, { description: null, related_companies: [] })).toEqual({ description: null, related_companies: [] })
    expect(yhdistaMetatiedot(null, { a: false })).toEqual({ a: false })
  })
})
