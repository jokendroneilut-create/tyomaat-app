import { describe, it, expect } from "vitest"
import { roolinSelite, roolinKuvaus } from "./yhteyshenkilonRooli"

describe("roolinSelite", () => {
  it("nimeaa kolme Hilman roolia", () => {
    expect(roolinSelite("buyer")).toBe("tilaaja")
    expect(roolinSelite("agent")).toBe("hankinnan hoitaja")
    expect(roolinSelite("winner")).toBe("urakoitsija")
  })

  /* Tuntematon rooli ei saa nayttaa keksittya selitetta. */
  it("palauttaa null tuntemattomasta ja tyhjasta", () => {
    expect(roolinSelite("jokumuu")).toBeNull()
    expect(roolinSelite(null)).toBeNull()
    expect(roolinSelite(undefined)).toBeNull()
  })
})

describe("roolinKuvaus", () => {
  /*
   * Agentin kuvauksen on kerrottava etta kyse on usein ERI yrityksesta
   * kuin tilaaja — muuten merkinta ei estä vaaraa oletusta.
   */
  it("kertoo agentista etta se on usein ulkopuolinen", () => {
    expect(roolinKuvaus("agent")).toMatch(/ulkopuolinen/i)
  })

  it("palauttaa null tuntemattomasta", () => {
    expect(roolinKuvaus("jokumuu")).toBeNull()
  })
})
