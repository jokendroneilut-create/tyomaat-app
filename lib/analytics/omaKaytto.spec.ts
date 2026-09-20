import { describe, expect, it } from "vitest"

import { omanKaytonEmails, omanKaytonIds } from "./omaKaytto"

describe("omanKaytonEmails", () => {
  it("yhdistaa admin- ja rajauslistan ilman kaksoiskappaleita", () => {
    expect(
      omanKaytonEmails({
        ADMIN_EMAILS: "a@x.fi",
        ANALYTICS_EXCLUDE_EMAILS: "b@y.fi, A@X.FI ,c@z.fi",
      })
    ).toEqual(["a@x.fi", "b@y.fi", "c@z.fi"])
  })

  it("tyhja rajauslista sailyttaa vanhan kayttaytymisen", () => {
    expect(omanKaytonEmails({ ADMIN_EMAILS: "a@x.fi" })).toEqual(["a@x.fi"])
  })
})

describe("omanKaytonIds", () => {
  const users = [
    { id: "1", email: "Admin@X.fi" },
    { id: "2", email: "testi@y.fi" },
    { id: "3", email: "asiakas@z.fi" },
    { id: "4", email: null },
  ]

  it("tunnistaa osoitteen kirjainkoosta riippumatta", () => {
    const ids = omanKaytonIds({ users, roolit: [], emails: ["admin@x.fi", "testi@y.fi"] })
    expect([...ids].sort()).toEqual(["1", "2"])
  })

  it("ottaa mukaan user_roles-taulun adminit", () => {
    const ids = omanKaytonIds({
      users,
      roolit: [{ user_id: "3", role: "admin" }, { user_id: "4", role: "seller" }],
      emails: [],
    })
    expect([...ids]).toEqual(["3"])
  })

  it("asiakas ei rajaudu pois", () => {
    const ids = omanKaytonIds({ users, roolit: null, emails: ["admin@x.fi"] })
    expect(ids.has("3")).toBe(false)
  })
})
