import { describe, expect, it } from "vitest"
import { LIIAN_PIENI, onPieniHanke, piilottaaPienet } from "./pienetHankkeet"

describe("piilottaaPienet", () => {
  it("alapeukku syyllä 'Liian pieni hanke' piilottaa pienet", () => {
    expect(piilottaaPienet([{ rating: "down", reason_category: LIIAN_PIENI }])).toBe(true)
  })
  it("muu syy, syy ilman alapeukkua tai ei palautetta ei piilota", () => {
    expect(piilottaaPienet([{ rating: "down", reason_category: "Ei kiinnosta" }])).toBe(false)
    expect(piilottaaPienet([{ rating: "up", reason_category: LIIAN_PIENI }])).toBe(false)
    expect(piilottaaPienet([{ rating: "down", reason_category: null }])).toBe(false)
    expect(piilottaaPienet([])).toBe(false)
  })
})

describe("onPieniHanke", () => {
  it("tunnistaa merkinnän tekstinä ja totuusarvona", () => {
    expect(onPieniHanke({ metadata: { pieni_hanke: "true" } })).toBe(true)
    expect(onPieniHanke({ metadata: { pieni_hanke: true } })).toBe(true)
    expect(onPieniHanke({ metadata: { pieni_hanke: null } })).toBe(false)
    expect(onPieniHanke({ metadata: {} })).toBe(false)
    expect(onPieniHanke({})).toBe(false)
  })
})
