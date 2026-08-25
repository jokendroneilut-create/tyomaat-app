import { describe, expect, it } from "vitest"

import { cleanContacts, toIsoDate, toPositiveNumber } from "./editFields"

describe("toIsoDate", () => {
  it("hyvaksyy YYYY-MM-DD", () => {
    expect(toIsoDate("2027-03-01")).toBe("2027-03-01")
    expect(toIsoDate(" 2026-12-31 ")).toBe("2026-12-31")
  })

  it("hylkaa muun muotoisen", () => {
    for (const paha of ["1.3.2027", "2027/03/01", "maaliskuu", "", null, undefined, 20270301]) {
      expect(toIsoDate(paha as any)).toBeNull()
    }
  })

  /*
   * new Date("2027-02-30") vierii maaliskuun toiseksi eika kerro
   * virheesta, joten olematon paiva on tarkistettava erikseen.
   */
  it("hylkaa olemattoman paivan", () => {
    expect(toIsoDate("2027-13-01")).toBeNull()
    expect(toIsoDate("2027-02-30")).toBeNull()
    expect(toIsoDate("2027-00-10")).toBeNull()
  })

  it("hyvaksyy karkauspaivan oikeana vuonna", () => {
    expect(toIsoDate("2028-02-29")).toBe("2028-02-29")
    expect(toIsoDate("2027-02-29")).toBeNull()
  })
})

describe("toPositiveNumber", () => {
  it("hyvaksyy positiivisen ja tyhjentaa tyhjan", () => {
    expect(toPositiveNumber("84")).toBe(84)
    expect(toPositiveNumber("")).toBeNull()
    expect(toPositiveNumber(null)).toBeNull()
  })

  it("hylkaa nollan ja negatiivisen", () => {
    expect(toPositiveNumber("0")).toBeNull()
    expect(toPositiveNumber("-5")).toBeNull()
    expect(toPositiveNumber("kaksi")).toBeNull()
  })
})

describe("cleanContacts", () => {
  it("siistii kentat ja paattelee lajin", () => {
    expect(cleanContacts([{ name: " Matti Meikalainen ", email: " Matti@X.FI ", phone: "040 1", title: " Tj " }])).toEqual([
      { name: "Matti Meikalainen", title: "Tj", organization: null, email: "matti@x.fi", phone: "040 1", kind: "person" },
    ])
  })

  /* Lomakkeen viimeinen tyhja rivi ei saa tallentua. */
  it("pudottaa taysin tyhjan rivin", () => {
    const c = cleanContacts([{ name: "", email: "", phone: "" }, { name: "Liisa Virtanen", email: "", phone: "" }])
    expect(c).toHaveLength(1)
    expect(c![0].name).toBe("Liisa Virtanen")
  })

  /* Tyhja lista on ainoa tapa poistaa vaarin poimittu yhteystieto. */
  it("sallii tyhjan listan", () => {
    expect(cleanContacts([])).toEqual([])
  })

  it("merkitsee nimettoman organisaatioksi", () => {
    expect(cleanContacts([{ name: "", email: "kirjaamo@x.fi", phone: "" }])![0].kind).toBe("organization")
  })

  it("sailyttaa roolin jos se on", () => {
    expect(cleanContacts([{ name: "A B", email: "a@b.fi", role: "authority" }])![0].role).toBe("authority")
  })

  it("hylkaa muun kuin listan", () => {
    expect(cleanContacts(null)).toBeNull()
    expect(cleanContacts("teksti")).toBeNull()
  })
})
