import { describe, expect, it } from "vitest"

import { chooseDuplicateSurvivor, completeness, moreAdvancedPhase } from "./duplicateSurvivor"

const tyhja = { id: "a", created_at: "2026-01-01T00:00:00Z" }

describe("completeness", () => {
  it("laskee tayttetyt kentat", () => {
    expect(completeness(tyhja)).toBe(0)
    expect(completeness({ ...tyhja, developer: "Nurmijärvi", builder: "Skanska" })).toBe(2)
  })

  it("ei laske tyhjaa merkkijonoa taytetyksi", () => {
    expect(completeness({ ...tyhja, developer: "", location: null })).toBe(0)
  })

  /* Nolla on kelvollinen arvo, ei puuttuva. */
  it("laskee nollan taytetyksi", () => {
    expect(completeness({ ...tyhja, lat: 0, lng: 0 })).toBe(2)
  })

  it("laskee kuvauksen ja yhteyshenkilot", () => {
    expect(
      completeness({
        ...tyhja,
        metadata: { description: "x".repeat(100), contact_persons: [{ name: "Matti" }] },
      })
    ).toBe(2)
  })

  /* Lyhyt kuvaus ei kerro hankkeesta mitaan. */
  it("ei laske lyhytta kuvausta", () => {
    expect(completeness({ ...tyhja, metadata: { description: "Lyhyt" } })).toBe(0)
  })
})

describe("chooseDuplicateSurvivor", () => {
  it("sailyttaa taydellisemman", () => {
    const a = { id: "a", created_at: "2026-03-20T00:00:00Z", builder: "Skanska", location: "Klaukkala" }
    const b = { id: "b", created_at: "2026-07-25T00:00:00Z", builder: "Skanska" }

    const tulos = chooseDuplicateSurvivor(a, b)
    expect(tulos.keepId).toBe("a")
    expect(tulos.hideId).toBe("b")
    expect(tulos.reason).toContain("enemmän")
  })

  it("valitsee taydellisemman jarjestyksesta riippumatta", () => {
    const a = { id: "a", created_at: "2026-03-20T00:00:00Z" }
    const b = { id: "b", created_at: "2026-07-25T00:00:00Z", builder: "Skanska" }

    expect(chooseDuplicateSurvivor(a, b).keepId).toBe("b")
    expect(chooseDuplicateSurvivor(b, a).keepId).toBe("b")
  })

  /*
   * Tasapelissa vanhempi jaa: siihen on ehtinyt kertya suosikkeja ja
   * asiakkaan omia muistiinpanoja.
   */
  it("tasapelissa vanhempi jaa", () => {
    const vanha = { id: "vanha", created_at: "2026-03-20T00:00:00Z", builder: "Skanska" }
    const uusi = { id: "uusi", created_at: "2026-07-25T00:00:00Z", builder: "Skanska" }

    expect(chooseDuplicateSurvivor(vanha, uusi).keepId).toBe("vanha")
    expect(chooseDuplicateSurvivor(uusi, vanha).keepId).toBe("vanha")
  })

  /* Tuntematon aikaleima ei ole vanhempi. */
  it("puuttuva aikaleima ei voita", () => {
    const tuntematon = { id: "tuntematon", created_at: null }
    const tiedetty = { id: "tiedetty", created_at: "2026-07-25T00:00:00Z" }

    expect(chooseDuplicateSurvivor(tuntematon, tiedetty).keepId).toBe("tiedetty")
    expect(chooseDuplicateSurvivor(tiedetty, tuntematon).keepId).toBe("tiedetty")
  })
})

describe("moreAdvancedPhase", () => {
  /* Yksinkertaistettu jarjestys testia varten. */
  const jarjestys = (p: string | null | undefined) =>
    p === "Suunnittelussa" ? 3 : p === "Rakenteilla" ? 7 : p === "Valmistunut" ? 9 : null

  /*
   * Taulumaen vesitorni: sailynyt sanoi "Suunnittelussa", piilotettu
   * Kreaten oma sivu "Rakenteilla". Vaihe olisi jaanyt vanhentuneeksi.
   */
  it("nostaa vaiheen kun piilotettu tietaa enemman", () => {
    expect(moreAdvancedPhase("Suunnittelussa", "Rakenteilla", jarjestys)).toBe("Rakenteilla")
  })

  /* Taaksepain ei siirreta. */
  it("ei laske vaihetta", () => {
    expect(moreAdvancedPhase("Rakenteilla", "Suunnittelussa", jarjestys)).toBeNull()
  })

  it("ei muuta samaa vaihetta", () => {
    expect(moreAdvancedPhase("Rakenteilla", "Rakenteilla", jarjestys)).toBeNull()
  })

  it("tuntematon vaihe ei nosta mitaan", () => {
    expect(moreAdvancedPhase("Suunnittelussa", "Roskaa", jarjestys)).toBeNull()
    expect(moreAdvancedPhase("Suunnittelussa", null, jarjestys)).toBeNull()
  })

  /* Tuntematon sailyvan vaihe: piilotetun tieto on parempi kuin ei mitaan. */
  it("tayttaa puuttuvan vaiheen", () => {
    expect(moreAdvancedPhase(null, "Rakenteilla", jarjestys)).toBe("Rakenteilla")
  })
})
