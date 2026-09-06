import { describe, expect, it } from "vitest"

import { kokonaisluku } from "./kokonaisluku"

describe("kokonaisluku", () => {
  it("kelpuuttaa numeron ja numeromerkkijonon", () => {
    expect(kokonaisluku(45)).toBe(45)
    expect(kokonaisluku("45")).toBe(45)
    expect(kokonaisluku("113 kpl")).toBe(113)
    expect(kokonaisluku("1 200")).toBe(1200)
  })

  /* Vali on epamaarainen: "3-5 huonetta" ei ole asuntomaara. */
  it("hylkaa valin ja muun tekstin", () => {
    expect(kokonaisluku("3-5")).toBeNull()
    expect(kokonaisluku("noin 40")).toBeNull()
    expect(kokonaisluku("useita")).toBeNull()
  })

  it("hylkaa nollan, negatiivisen ja roskan", () => {
    expect(kokonaisluku(0)).toBeNull()
    expect(kokonaisluku(-5)).toBeNull()
    expect(kokonaisluku(null)).toBeNull()
    expect(kokonaisluku(undefined)).toBeNull()
    expect(kokonaisluku({})).toBeNull()
  })

  it("hylkaa ylarajan ylittavan", () => {
    expect(kokonaisluku(200000)).toBeNull()
    expect(kokonaisluku(500, 100)).toBeNull()
  })
})
