import { describe, expect, it } from "vitest"
import { isAccountLocked } from "./isAccountLocked"

const now = new Date("2026-09-27T12:00:00Z")

describe("isAccountLocked", () => {
  it("lukittu kun admin on asettanut lipun", () => {
    expect(isAccountLocked({ app_metadata: { locked: true } }, now)).toBe(true)
  })

  it("lukittu kun estoaika on tulevaisuudessa, vaikka lippu puuttuu", () => {
    expect(isAccountLocked({ banned_until: "2126-09-27T12:00:00Z" }, now)).toBe(true)
  })

  it("ei lukittu kun estoaika on mennyt (lukitus purettu)", () => {
    expect(isAccountLocked({ banned_until: "2026-09-26T12:00:00Z" }, now)).toBe(false)
  })

  it("ei lukittu tavallisella käyttäjällä", () => {
    expect(isAccountLocked({ app_metadata: { provider: "email" }, banned_until: null }, now)).toBe(false)
    expect(isAccountLocked(null, now)).toBe(false)
  })

  it("purettu lippu (false) ei lukitse", () => {
    expect(isAccountLocked({ app_metadata: { locked: false } }, now)).toBe(false)
  })
})
