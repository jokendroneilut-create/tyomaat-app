import { describe, expect, it } from "vitest"

import { canSeeOwnCustomers, isAdmin, parseAdminEmails, resolveRole } from "./roles"

describe("parseAdminEmails", () => {
  it("lukee pilkkulistan ja siistii", () => {
    expect(parseAdminEmails(" A@b.fi , c@d.fi ")).toEqual(["a@b.fi", "c@d.fi"])
  })

  it("kestaa tyhjan", () => {
    expect(parseAdminEmails("")).toEqual([])
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails(null)).toEqual([])
  })
})

describe("resolveRole", () => {
  const adminEmails = ["pomo@tyomaat.fi"]

  /*
   * Ymparistomuuttuja voittaa, jottei admin voi lukita itseaan ulos
   * rikkomalla kannan sisallon.
   */
  it("antaa adminin ymparistomuuttujasta ilman kantariviä", () => {
    expect(resolveRole({ email: "pomo@tyomaat.fi", dbRole: null, adminEmails })).toBe("admin")
  })

  it("antaa adminin ymparistomuuttujasta vaikka kanta sanoisi myyja", () => {
    expect(resolveRole({ email: "pomo@tyomaat.fi", dbRole: "seller", adminEmails })).toBe("admin")
  })

  it("ei valita kirjainkoosta eika valilyonneista", () => {
    expect(resolveRole({ email: "  POMO@Tyomaat.FI ", dbRole: null, adminEmails })).toBe("admin")
  })

  it("antaa adminin kannasta", () => {
    expect(resolveRole({ email: "muu@x.fi", dbRole: "admin", adminEmails })).toBe("admin")
  })

  it("antaa myyjan kannasta", () => {
    expect(resolveRole({ email: "myyja@x.fi", dbRole: "seller", adminEmails })).toBe("seller")
  })

  it("tavallinen kayttaja ilman riviä", () => {
    expect(resolveRole({ email: "asiakas@x.fi", dbRole: null, adminEmails })).toBe("user")
  })

  /*
   * Tuntematon arvo ei saa koskaan tuottaa oikeuksia. Jos kantaan
   * paatyy roska, se on tavallinen kayttaja eika admin.
   */
  it("tuntematon rooli on tavallinen kayttaja", () => {
    expect(resolveRole({ email: "x@x.fi", dbRole: "superadmin", adminEmails })).toBe("user")
    expect(resolveRole({ email: "x@x.fi", dbRole: "", adminEmails })).toBe("user")
    expect(resolveRole({ email: "x@x.fi", dbRole: "ADMIN", adminEmails })).toBe("user")
  })

  /* Tyhja sahkoposti ei saa osua tyhjaan listaan. */
  it("tyhja sahkoposti ei tuota adminia", () => {
    expect(resolveRole({ email: null, dbRole: null, adminEmails: [] })).toBe("user")
    expect(resolveRole({ email: "", dbRole: null, adminEmails: [""] })).toBe("user")
  })
})

describe("oikeudet", () => {
  it("vain admin on admin", () => {
    expect(isAdmin("admin")).toBe(true)
    expect(isAdmin("seller")).toBe(false)
    expect(isAdmin("user")).toBe(false)
  })

  it("admin ja myyja naekevat asiakaslistan", () => {
    expect(canSeeOwnCustomers("admin")).toBe(true)
    expect(canSeeOwnCustomers("seller")).toBe(true)
    expect(canSeeOwnCustomers("user")).toBe(false)
  })
})
