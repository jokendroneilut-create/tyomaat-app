import { describe, expect, it } from "vitest"

import { visibleUsers } from "./visibleUsers"

const MYYJA = "myyja-1"
const TOINEN = "myyja-2"

const kayttajat = [
  { id: "a", ownerId: MYYJA },
  { id: "b", ownerId: TOINEN },
  { id: "c", ownerId: null },
  { id: "d" },
]

describe("visibleUsers", () => {
  it("admin nakee kaikki", () => {
    expect(visibleUsers("admin", "kuka-vain", kayttajat)).toHaveLength(4)
  })

  it("myyja nakee vain omansa", () => {
    const nakyy = visibleUsers("seller", MYYJA, kayttajat)
    expect(nakyy.map((u) => u.id)).toEqual(["a"])
  })

  /* Tama on se vuoto jota vastaan funktio on olemassa. */
  it("myyja EI nae toisen myyjan asiakkaita", () => {
    const nakyy = visibleUsers("seller", MYYJA, kayttajat)
    expect(nakyy.some((u) => u.ownerId === TOINEN)).toBe(false)
  })

  it("liittamaton asiakas ei nay myyjalle", () => {
    const nakyy = visibleUsers("seller", MYYJA, kayttajat)
    expect(nakyy.some((u) => !u.ownerId)).toBe(false)
  })

  it("tavallinen kayttaja ei nae ketaan", () => {
    expect(visibleUsers("user", MYYJA, kayttajat)).toEqual([])
  })

  /*
   * Tyhja katsojatunnus ei saa osua liittamattomiin (ownerId null tai
   * puuttuu), mika olisi juuri se hiljainen vuoto.
   */
  it("tyhja katsojatunnus ei nae mitaan", () => {
    expect(visibleUsers("seller", "", kayttajat)).toEqual([])
  })

  it("kestaa tyhjan listan", () => {
    expect(visibleUsers("seller", MYYJA, [])).toEqual([])
    expect(visibleUsers("admin", MYYJA, [])).toEqual([])
  })
})
