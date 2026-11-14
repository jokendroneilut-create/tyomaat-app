import { describe, expect, it } from "vitest"
import { completionStatusPatch, mennytPaiva } from "./completionStatus"

const NYT = "2026-11-15T12:00:00.000Z"

describe("completionStatusPatch (D-421)", () => {
  /*
   * 30 riviä oli Valmistunut / active 15.11.2026: vaihe kirjoitettiin,
   * tila ei.
   */
  it("valmistunut vaihe asettaa tilan ja ajan", () => {
    expect(completionStatusPatch("Valmistunut", { status: "active", completed_at: null }, NYT)).toEqual({
      status: "completed",
      completed_at: NYT,
    })
  })

  it("säilyttää jo kirjatun valmistumisajan", () => {
    expect(
      completionStatusPatch("Valmistunut", { status: "active", completed_at: "2025-06-30T12:00:00Z" }, NYT)
    ).toEqual({ status: "completed", completed_at: "2025-06-30T12:00:00Z" })
  })

  it("lukee myös avaimen ja kirjainkoon", () => {
    expect(completionStatusPatch("completed", null, NYT).status).toBe("completed")
    expect(completionStatusPatch("valmistunut", null, NYT).status).toBe("completed")
  })

  it("ei muuta mitään kun jo valmis ja aika on", () => {
    expect(
      completionStatusPatch("Valmistunut", { status: "completed", completed_at: "2025-01-01T00:00:00Z" }, NYT)
    ).toEqual({})
  })

  /* Käsin palautus: Porthania Valmistunut -> Rakenteilla. */
  it("palautus pois valmistuneesta aktivoi rivin", () => {
    expect(
      completionStatusPatch("Rakenteilla", { status: "completed", completed_at: "2026-10-03T00:00:00Z" }, NYT)
    ).toEqual({ status: "active", completed_at: null })
  })

  it("muu vaihe ei koske aktiivisen tai vanhentuneen tilaan", () => {
    expect(completionStatusPatch("Rakenteilla", { status: "active" }, NYT)).toEqual({})
    expect(completionStatusPatch("Kilpailutus", { status: "expired" }, NYT)).toEqual({})
    expect(completionStatusPatch("Suunnittelussa", null, NYT)).toEqual({})
  })

  it("tyhjä vaihe ei aktivoi valmista", () => {
    expect(completionStatusPatch(null, { status: "completed" }, NYT)).toEqual({})
  })
})

describe("mennytPaiva", () => {
  const nyt = new Date(NYT)
  it("mennyt päivä kelpaa", () => {
    expect(mennytPaiva("2026-05-24", nyt)).toBe("2026-05-24T00:00:00.000Z")
  })
  it("tuleva päivä on arvio, ei tapahtuma", () => {
    expect(mennytPaiva("2026-12-31", nyt)).toBeNull()
  })
  it("tyhjä ja roska", () => {
    expect(mennytPaiva(null, nyt)).toBeNull()
    expect(mennytPaiva("ei päivä", nyt)).toBeNull()
  })
})
