import { describe, expect, it, vi, beforeEach } from "vitest"

/*
 * NAKYVYYSRAJA ON TIETOTURVARAJA, ei nakymalogiikkaa: jos tama vuotaa,
 * myyja nakee toisen myyjan asiakkaan kayttohistorian. Siksi se
 * testataan reitin tasolla eika vain `visibleUsers`-funktiona.
 *
 * Kirjautunutta istuntoa ei tarvita: rooli ja Supabase-vastaukset
 * korvataan, jolloin testi koskee tasan sita paatosta jonka reitti
 * tekee.
 */

const rooli = { arvo: { ok: true, role: "seller", userId: "myyja-1", email: "m@example.com" } as any }

vi.mock("@/lib/auth/getRequestRole", () => ({
  getRequestRole: async () => rooli.arvo,
}))

/* customer_owners: asiakas-1 kuuluu myyjalle 1, asiakas-2 toiselle. */
const LIITOKSET = [
  { user_id: "asiakas-1", seller_id: "myyja-1" },
  { user_id: "asiakas-2", seller_id: "myyja-2" },
]

const TAPAHTUMAT = [
  {
    user_id: "asiakas-1",
    event_type: "login",
    path: null,
    duration_seconds: null,
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    user_id: "asiakas-1",
    event_type: "pageview",
    path: "/today",
    duration_seconds: 300,
    created_at: "2026-09-01T08:00:05Z",
  },
]

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (taulu: string) => ({
      select: () => {
        if (taulu === "customer_owners") {
          return Promise.resolve({ data: LIITOKSET, error: null })
        }
        return {
          eq: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: TAPAHTUMAT, error: null }),
            }),
          }),
        }
      },
    }),
  }),
}))

async function kutsu(userId: string) {
  const { GET } = await import("./route")
  const res = await GET(new Request(`http://localhost/api/admin/user-activity?userId=${userId}`))
  return { status: res.status, body: await res.json() }
}

describe("GET /api/admin/user-activity", () => {
  beforeEach(() => {
    rooli.arvo = { ok: true, role: "seller", userId: "myyja-1", email: "m@example.com" }
  })

  it("nayttaa myyjalle hanen oman asiakkaansa kayton", async () => {
    const { status, body } = await kutsu("asiakas-1")
    expect(status).toBe(200)
    expect(body.paivat).toHaveLength(1)
    expect(body.paivat[0]).toMatchObject({
      paiva: "2026-09-01",
      kirjautumisia: 1,
      sekunteja: 300,
    })
  })

  /* Tama on se rivi joka ei saa koskaan muuttua. */
  it("ei nayta toisen myyjan asiakasta", async () => {
    const { status, body } = await kutsu("asiakas-2")
    expect(status).toBe(403)
    expect(body.error).toBe("forbidden")
  })

  it("ei nayta liittamatonta asiakasta", async () => {
    const { status } = await kutsu("asiakas-3")
    expect(status).toBe(403)
  })

  it("torjuu tavallisen kayttajan", async () => {
    rooli.arvo = { ok: true, role: "user", userId: "asiakas-1", email: "a@example.com" }
    const { status } = await kutsu("asiakas-1")
    expect(status).toBe(403)
  })

  it("torjuu kirjautumattoman", async () => {
    rooli.arvo = { ok: false, status: 401, error: "unauthorized" }
    const { status } = await kutsu("asiakas-1")
    expect(status).toBe(401)
  })
})
