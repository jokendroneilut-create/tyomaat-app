import { describe, it, expect } from "vitest"
import {
  textIndicatesCompletion,
  stripCompletionWords,
} from "./detectCompletionFromText"

describe("textIndicatesCompletion", () => {
  it("tunnistaa valmistumisen otsikosta", () => {
    expect(textIndicatesCompletion("FINNOONNIITYN LINJA-AUTOVARIKKO VALMIS")).toBe(true)
    expect(textIndicatesCompletion("Kohde luovutettu tilaajalle")).toBe(true)
    expect(textIndicatesCompletion("Uusi koulu valmistui Espooseen")).toBe(true)
    expect(textIndicatesCompletion("Päiväkoti otettiin käyttöön")).toBe(true)
  })

  it("ei tulkitse tulevaa valmistumista valmiiksi", () => {
    expect(textIndicatesCompletion("Hanke valmistuu vuonna 2027")).toBe(false)
    expect(textIndicatesCompletion("Kohde on valmistumassa ensi keväänä")).toBe(false)
    expect(textIndicatesCompletion("Rakentaminen käynnistyy elokuussa")).toBe(false)
  })

  it("ei osu sanaan valmisteleva", () => {
    expect(
      textIndicatesCompletion("Rakentamista valmisteleva puiden kaato tontilta")
    ).toBe(false)
  })

  it("lukee myös kuvauksen", () => {
    expect(
      textIndicatesCompletion("Koulun peruskorjaus", "Kohde luovutettiin kesäkuussa.")
    ).toBe(true)
  })

  it("sietää tyhjät", () => {
    expect(textIndicatesCompletion(null, undefined, "")).toBe(false)
  })
})

describe("stripCompletionWords", () => {
  it("poistaa valmistumissanan otsikon lopusta", () => {
    expect(stripCompletionWords("FINNOONNIITYN LINJA-AUTOVARIKKO VALMIS")).toBe(
      "FINNOONNIITYN LINJA-AUTOVARIKKO"
    )
    expect(stripCompletionWords("Kalasataman koulu on valmis")).toBe(
      "Kalasataman koulu"
    )
    expect(stripCompletionWords("Toimitalo - luovutettu tilaajalle")).toBe("Toimitalo")
  })

  it("jättää otsikon rauhaan kun valmistumissanaa ei ole", () => {
    const title = "Uusi päiväkoti Tampereen Hervantaan"
    expect(stripCompletionWords(title)).toBe(title)
  })

  it("ei typistä otsikkoa liian lyhyeksi", () => {
    // Poiston jälkeen jäisi "Talo" - liian vähän tunnistamiseen, joten
    // alkuperäinen säilyy.
    expect(stripCompletionWords("Talo valmis")).toBe("Talo valmis")
  })

  it("sietää tyhjät", () => {
    expect(stripCompletionWords(null)).toBeNull()
    expect(stripCompletionWords("")).toBe("")
  })
})
