import { describe, expect, it } from "vitest"

import { YRITYSTIEDOTTEEN_IKKUNA_KK, tiedotteenAikaraja } from "./tiedotteenIkkuna"

describe("tiedotteenAikaraja", () => {
  /* Kynnys on mitattu, ei arvattu: ks. moduulin kommentti. */
  it("ikkuna on 12 kuukautta", () => {
    expect(YRITYSTIEDOTTEEN_IKKUNA_KK).toBe(12)
  })

  it("palauttaa vuoden taaksepain", () => {
    expect(tiedotteenAikaraja(new Date("2026-10-02T00:00:00Z")).toISOString().slice(0, 10)).toBe("2025-10-02")
  })

  /*
   * Rajatapaus joka paljasti virheen 29.1.2026 tiedotteessa: kahdeksan
   * kuukautta vanha mahtuu ikkunaan, kolmetoista ei.
   */
  it("paastaa kahdeksan kuukauden takaisen, torjuu kolmentoista", () => {
    const raja = tiedotteenAikaraja(new Date("2026-10-02T00:00:00Z"))
    expect(new Date("2026-01-29") >= raja).toBe(true)
    expect(new Date("2025-08-27") >= raja).toBe(false)
  })

  /* Vuodenvaihde: kuukausilaskenta ei saa hypata vuotta vaarin. */
  it("kestaa vuodenvaihteen", () => {
    expect(tiedotteenAikaraja(new Date("2026-01-15T00:00:00Z")).toISOString().slice(0, 10)).toBe("2025-01-15")
  })

  it("ei muuta annettua paivaa", () => {
    const nyt = new Date("2026-10-02T00:00:00Z")
    tiedotteenAikaraja(nyt)
    expect(nyt.toISOString().slice(0, 10)).toBe("2026-10-02")
  })
})
