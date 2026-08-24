import { describe, expect, it } from "vitest"

import {
  DEFAULT_WINDOW_HOURS,
  MAX_LOOKBACK_HOURS,
  resolveWindow,
} from "./window"

const NYT = new Date("2026-08-25T08:00:00Z").getTime()
const tuntiaSitten = (h: number) => new Date(NYT - h * 3600_000).toISOString()

describe("resolveWindow", () => {
  it("kayttaa vesirajaa kun se on olemassa", () => {
    const r = resolveWindow({ now: NYT, watermark: tuntiaSitten(24) })
    expect(r.source).toBe("watermark")
    expect(r.hours).toBe(24)
  })

  /*
   * Tama on koko korjauksen syy: 24.8. jai valiin yksi ajo ja
   * 18 tuntia putosi ikkunoiden valiin. Vesirajan kanssa ei putoa.
   */
  it("kattaa valiin jaaneen ajon ilman katvetta", () => {
    /* Edellinen onnistunut ajo oli 48 h sitten (yksi vuorokausi valiin). */
    const r = resolveWindow({ now: NYT, watermark: tuntiaSitten(48) })
    expect(r.source).toBe("watermark")
    expect(r.hours).toBe(48)
    /* Kiintealla ikkunalla olisi menetetty 48 - 30 = 18 tuntia. */
    expect(r.hours).toBeGreaterThan(DEFAULT_WINDOW_HOURS)
  })

  it("katkaisee kattoon kun vesiraja on liian vanha", () => {
    const r = resolveWindow({ now: NYT, watermark: tuntiaSitten(30 * 24) })
    expect(r.source).toBe("clamped")
    expect(r.hours).toBe(MAX_LOOKBACK_HOURS)
  })

  it("palaa oletusikkunaan ilman vesirajaa", () => {
    expect(resolveWindow({ now: NYT }).source).toBe("fallback")
    expect(resolveWindow({ now: NYT, watermark: null }).hours).toBe(DEFAULT_WINDOW_HOURS)
  })

  it("palaa oletusikkunaan jos vesiraja on roskaa", () => {
    const r = resolveWindow({ now: NYT, watermark: "ei-aikaleima" })
    expect(r.source).toBe("fallback")
    expect(r.hours).toBe(DEFAULT_WINDOW_HOURS)
  })

  it("ei skannaa mitaan jos vesiraja on tulevaisuudessa", () => {
    const r = resolveWindow({ now: NYT, watermark: tuntiaSitten(-5) })
    expect(r.hours).toBe(0)
  })

  it("kasin annettu hours ohittaa vesirajan", () => {
    const r = resolveWindow({ now: NYT, overrideHours: 32, watermark: tuntiaSitten(2) })
    expect(r.source).toBe("override")
    expect(r.hours).toBe(32)
  })

  it("kasin annettu hours ei ole katon alainen - korjausajo saa yltaa kauas", () => {
    const r = resolveWindow({ now: NYT, overrideHours: 30 * 24 })
    expect(r.source).toBe("override")
    expect(r.hours).toBe(30 * 24)
  })

  /* Kelvoton arvo ei saa kutistaa ikkunaa hiljaa - se ohitetaan. */
  it("ohittaa kelvottoman hours-arvon ja kayttaa vesirajaa", () => {
    for (const paha of [0, -5, NaN]) {
      const r = resolveWindow({ now: NYT, overrideHours: paha, watermark: tuntiaSitten(9) })
      expect(r.source).toBe("watermark")
      expect(r.hours).toBe(9)
    }
    expect(resolveWindow({ now: NYT, overrideHours: 0 }).source).toBe("fallback")
  })
})
