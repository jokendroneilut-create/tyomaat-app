import { describe, expect, it } from "vitest"

import { relevanssiportinTila, selitaVirhe } from "./relevanssiportinTila"

const ok = (aika: string) => ({ created_at: aika, final_status: "needs_review", llm_reason: null })
const virhe = (aika: string, syy: string) => ({ created_at: aika, final_status: "llm_error", llm_reason: syy })

describe("relevanssiportinTila", () => {
  /* Tilanne 1.10.2026: virhe 24.9. ja sen jalkeen satoja onnistuneita. */
  it("ei ole tauolla kun virheen jalkeen on onnistuneita kutsuja", () => {
    const tila = relevanssiportinTila([
      ok("2026-10-01T18:01:53Z"),
      ok("2026-09-25T10:00:00Z"),
      virhe("2026-09-24T19:17:11Z", "Request timed out."),
      ok("2026-09-24T19:10:00Z"),
    ])

    expect(tila.tauolla).toBe(false)
    expect(tila.onnistuneitaVirheenJalkeen).toBe(2)
    expect(tila.viimeisinVirheAika).toBe("2026-09-24T19:17:11Z")
    expect(tila.virheita).toBe(1)
  })

  it("on tauolla kun uusin kutsu on virhe", () => {
    const tila = relevanssiportinTila([
      virhe("2026-09-24T19:17:11Z", "Request timed out."),
      ok("2026-09-24T19:00:00Z"),
    ])

    expect(tila.tauolla).toBe(true)
    expect(tila.onnistuneitaVirheenJalkeen).toBe(0)
  })

  /* Perakkaiset virheet eivat ole toipumista. */
  it("ei laske toista virhetta onnistumiseksi", () => {
    const tila = relevanssiportinTila([
      virhe("2026-09-24T19:17:11Z", "Request timed out."),
      virhe("2026-09-24T19:14:55Z", "Request timed out."),
      ok("2026-09-24T19:00:00Z"),
    ])

    expect(tila.tauolla).toBe(true)
    expect(tila.virheita).toBe(2)
  })

  it("sietaa virheettoman ikkunan", () => {
    const tila = relevanssiportinTila([ok("2026-10-01T18:01:53Z")])
    expect(tila).toMatchObject({ virheita: 0, tauolla: false, viimeisinVirheAika: null, selitys: null })
    expect(relevanssiportinTila([]).virheita).toBe(0)
  })
})

describe("selitaVirhe", () => {
  /* Vanha teksti vaitti aina varojen loppumista - syy luetaan viestista. */
  it("tunnistaa aikakatkaisun eika puhu varoista", () => {
    const selitys = selitaVirhe("Request timed out.")!
    expect(selitys).toContain("aikakatkaisun")
    expect(selitys).not.toContain("varat")
  })

  it("tunnistaa varojen loppumisen", () => {
    expect(selitaVirhe("Your credit balance is too low")).toContain("API-varat")
  })

  it("tunnistaa pyyntorajan ja virheellisen avaimen", () => {
    expect(selitaVirhe("429 rate_limit_error")).toContain("Pyyntöraja")
    expect(selitaVirhe("401 authentication_error")).toContain("API-avain")
  })

  it("palauttaa null kun viesti ei kerro syyta", () => {
    expect(selitaVirhe("vastaus ei sisältänyt tekstilohkoa")).toBeNull()
    expect(selitaVirhe("")).toBeNull()
    expect(selitaVirhe(null)).toBeNull()
  })
})
