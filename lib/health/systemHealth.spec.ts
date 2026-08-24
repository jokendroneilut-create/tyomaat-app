import { describe, expect, it } from "vitest"

import { allOk, alertKey, buildAlertEmail, parseAdminEmails, type CheckResult } from "./systemHealth"

const ok = (name: string): CheckResult => ({ name, ok: true, status: 200, ms: 42 })
const rikki = (name: string, status: number | null = 522): CheckResult => ({
  name,
  ok: false,
  status,
  ms: 8000,
  error: status === null ? "aikakatkaisu 8000 ms" : undefined,
})

describe("alertKey", () => {
  it("on sama saman tunnin sisalla", () => {
    const a = alertKey(new Date("2026-08-23T22:05:00Z"))
    const b = alertKey(new Date("2026-08-23T22:55:00Z"))
    expect(a).toBe(b)
  })

  it("vaihtuu tunnin vaihtuessa, jotta jatkuva katko muistuttaa uudelleen", () => {
    const a = alertKey(new Date("2026-08-23T22:55:00Z"))
    const b = alertKey(new Date("2026-08-23T23:05:00Z"))
    expect(a).not.toBe(b)
  })

  it("erottaa saman kellonajan eri vuorokausina", () => {
    expect(alertKey(new Date("2026-08-23T22:00:00Z"))).not.toBe(
      alertKey(new Date("2026-08-24T22:00:00Z"))
    )
  })
})

describe("allOk", () => {
  it("vaatii kaikkien onnistuvan", () => {
    expect(allOk([ok("kirjautuminen"), ok("tietokanta")])).toBe(true)
    expect(allOk([ok("kirjautuminen"), rikki("tietokanta")])).toBe(false)
    expect(allOk([])).toBe(true)
  })
})

describe("buildAlertEmail", () => {
  const nyt = new Date("2026-08-23T22:40:00Z")

  it("nimeaa rikkinaisen otsikossa, koska se luetaan lukitusnaytolta", () => {
    const { subject } = buildAlertEmail([rikki("kirjautuminen"), ok("tietokanta")], nyt)
    expect(subject).toContain("kirjautuminen")
    expect(subject).not.toContain("tietokanta")
    expect(subject).toContain("22:40")
  })

  it("listaa molemmat kun molemmat ovat rikki", () => {
    const { subject } = buildAlertEmail([rikki("kirjautuminen"), rikki("tietokanta")], nyt)
    expect(subject).toContain("kirjautuminen")
    expect(subject).toContain("tietokanta")
  })

  it("kertoo myos onnistuneet, jotta vian laajuus nakyy", () => {
    const { text } = buildAlertEmail([rikki("kirjautuminen"), ok("tietokanta")], nyt)
    expect(text).toContain("VIRHE")
    expect(text).toContain("OK")
    expect(text).toContain("HTTP 522")
  })

  it("nayttaa aikakatkaisun syyna kun vastausta ei tullut", () => {
    const { text } = buildAlertEmail([rikki("tietokanta", null)], nyt)
    expect(text).toContain("aikakatkaisu")
  })

  it("sisaltaa korjausohjeen", () => {
    const { text } = buildAlertEmail([rikki("kirjautuminen")], nyt)
    expect(text).toContain("Restart project")
  })
})

describe("parseAdminEmails", () => {
  it("pilkkoo, siistii ja pudottaa tyhjat", () => {
    expect(parseAdminEmails(" A@b.fi , c@d.fi ,, ")).toEqual(["a@b.fi", "c@d.fi"])
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails("")).toEqual([])
  })
})
