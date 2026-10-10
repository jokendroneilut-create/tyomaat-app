import { describe, it, expect } from "vitest"
import { kanoninenLahdeUrl, sttTiedotteenId } from "./lahdeUrl"

describe("kanoninenLahdeUrl", () => {
  /* Mitattu pari: sama tiedote tuotti kaksi hanketta (D-266). */
  it("yhdistaa saman tiedotteen kaksi polkua", () => {
    const a = "https://www.sttinfo.fi/release/72371945/hartela-rakentaa-yes-eun-uuden-paakonttorin-aviapolikseen?publisherId=1812&lang=fi"
    const b = "https://www.sttinfo.fi/tiedote/72371945/hartela-rakentaa-yes-eun-uuden-paakonttorin-aviapolikseen?publisherId=1812&lang=fi"
    expect(kanoninenLahdeUrl(a)).toBe(kanoninenLahdeUrl(b))
    expect(kanoninenLahdeUrl(a)).toBe("https://www.sttinfo.fi/tiedote/72371945")
  })

  it("ei sekoita eri tiedotteita", () => {
    expect(kanoninenLahdeUrl("https://www.sttinfo.fi/tiedote/72371945/x")).not.toBe(
      kanoninenLahdeUrl("https://www.sttinfo.fi/tiedote/72371946/x")
    )
  })

  /* Slugi ja kyselyparametrit eivat saa vaikuttaa. */
  it("sivuuttaa otsikkoslugin ja parametrit", () => {
    expect(kanoninenLahdeUrl("https://www.sttinfo.fi/tiedote/123/vanha-otsikko?lang=sv")).toBe(
      kanoninenLahdeUrl("https://www.sttinfo.fi/tiedote/123/korjattu-otsikko")
    )
  })

  /* Muita sivustoja ei yleisteta arvaamalla. */
  it("palauttaa muut osoitteet ennallaan", () => {
    const u = "https://www.kerava.fi/kaavoitus/jokin-sivu/"
    expect(kanoninenLahdeUrl(u)).toBe(u)
    expect(kanoninenLahdeUrl(null)).toBe("")
  })

  it("tunnistaa tiedotteen id:n", () => {
    expect(sttTiedotteenId("https://www.sttinfo.fi/release/999/x")).toBe("999")
    expect(sttTiedotteenId("https://example.com/999")).toBeNull()
  })
})
