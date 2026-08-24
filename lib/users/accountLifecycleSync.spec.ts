import { describe, expect, it } from "vitest"

import { planLifecycleSync } from "./accountLifecycleSync"

const NYT = "2026-08-24T18:00:00.000Z"

const authUser = (id: string, email: string | null, created: string | null = "2026-08-01T00:00:00Z") => ({
  id,
  email,
  created_at: created,
})

describe("planLifecycleSync", () => {
  it("kirjaa uuden tunnuksen jota ei ole lokissa", () => {
    const p = planLifecycleSync({
      authUsers: [authUser("u1", "a@b.fi")],
      profiles: [],
      existing: [],
      now: NYT,
    })
    expect(p.created).toHaveLength(1)
    expect(p.created[0]).toMatchObject({
      user_id: "u1",
      email: "a@b.fi",
      event: "created",
      occurred_at: "2026-08-01T00:00:00Z",
    })
  })

  it("ei kirjaa uudestaan jo tunnettua", () => {
    const p = planLifecycleSync({
      authUsers: [authUser("u1", "a@b.fi")],
      profiles: [],
      existing: [{ user_id: "u1", event: "created" }],
      now: NYT,
    })
    expect(p.created).toHaveLength(0)
  })

  /*
   * Luontipaiva on koko lokin tarkoitus. Ilman sita rivi olisi arvoton,
   * ja arvoton rivi estaisi oikean kirjaamisen myohemmin uniikkirajoitteen
   * takia.
   */
  it("ohittaa tunnuksen jolta puuttuu luontipaiva", () => {
    const p = planLifecycleSync({
      authUsers: [authUser("u1", "a@b.fi", null)],
      profiles: [],
      existing: [],
      now: NYT,
    })
    expect(p.created).toHaveLength(0)
  })

  it("ottaa nimen ja varasahkopostin profiilista", () => {
    const p = planLifecycleSync({
      authUsers: [authUser("u1", null)],
      profiles: [{ id: "u1", email: "varalta@b.fi", full_name: "Veli" }],
      existing: [],
      now: NYT,
    })
    expect(p.created[0]).toMatchObject({ email: "varalta@b.fi", full_name: "Veli" })
  })

  it("kirjaa kadonneen tunnuksen poistetuksi havaintohetkella", () => {
    const p = planLifecycleSync({
      authUsers: [],
      profiles: [],
      existing: [{ user_id: "u1", event: "created" }],
      now: NYT,
    })
    expect(p.deleted).toHaveLength(1)
    expect(p.deleted[0].occurred_at).toBe(NYT)
    expect(p.deleted[0].metadata).toMatchObject({ occurred_at_is_detection_time: true })
  })

  it("ei kirjaa poistoa toiseen kertaan", () => {
    const p = planLifecycleSync({
      authUsers: [],
      profiles: [],
      existing: [
        { user_id: "u1", event: "created" },
        { user_id: "u1", event: "deleted" },
      ],
      now: NYT,
    })
    expect(p.deleted).toHaveLength(0)
  })

  it("laskee molemmat suunnat samalla ajolla", () => {
    const p = planLifecycleSync({
      authUsers: [authUser("uusi", "uusi@b.fi")],
      profiles: [],
      existing: [{ user_id: "vanha", event: "created" }],
      now: NYT,
    })
    expect(p.created.map((r) => r.user_id)).toEqual(["uusi"])
    expect(p.deleted.map((r) => r.user_id)).toEqual(["vanha"])
    expect(p.authCount).toBe(1)
    expect(p.knownUsers).toBe(1)
  })
})
