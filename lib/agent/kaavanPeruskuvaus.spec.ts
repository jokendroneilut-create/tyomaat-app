import { describe, expect, it } from "vitest"

import { kaavanPeruskuvaus } from "./kaavanPeruskuvaus"

/* Johanneksen kysyma rivi, mitattu lahteesta 31.10.2026. */
const PERINTOTIE = {
  kunta: "Vantaa",
  kaavaTunnus: "002258",
  nimi: "002258 Perintötie 6 ja Robert Huberintie 5",
  vaihe: "Vireilletullut",
  oasPvm: "2027-12-14",
}

describe("kaavanPeruskuvaus", () => {
  it("kirjoittaa kuvauksen kuudesta kentasta", () => {
    expect(kaavanPeruskuvaus(PERINTOTIE)).toBe(
      "Kaava 002258, Vantaa. Kohde Perintötie 6 ja Robert Huberintie 5. " +
        "Vaihe: Vireilletullut. Osallistumis- ja arviointisuunnitelma 14.12.2027."
    )
  })

  /* Tunnus on jo lauseen alussa; nimessa se toistuisi. */
  it("riisuu tunnuksen nimen alusta", () => {
    expect(kaavanPeruskuvaus(PERINTOTIE)).not.toMatch(/002258.*002258/)
  })

  it("kestaa nimen jossa tunnusta ei ole", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, nimi: "Perintötie 6" })
    expect(k).toContain("Kohde Perintötie 6.")
  })

  /*
   * KAAVALAJIA EI VAITETA. Aineistossa on muitakin sarjoja kuin
   * asemakaavat (251900, 181200, 920600).
   */
  it("ei vaita kaavalajia", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, kaavaTunnus: "920600" })
    expect(k).toContain("Kaava 920600")
    expect(k).not.toMatch(/asemakaava/i)
  })

  /*
   * Vaihe kirjoitetaan sellaisenaan: pykalaviite ja iso alkukirjain
   * rikkoutuisivat siistimisesta.
   */
  it("ei muuta vaiheen sanamuotoa", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, vaihe: "Alustava kuuleminen (MRL 62 §)" })
    expect(k).toContain("Vaihe: Alustava kuuleminen (MRL 62 §).")
  })

  it("jattaa puuttuvat kentat pois eika kirjoita tyhjaa", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, vaihe: null, oasPvm: null })
    expect(k).toBe("Kaava 002258, Vantaa. Kohde Perintötie 6 ja Robert Huberintie 5.")
    expect(k).not.toContain("Vaihe")
    expect(k).not.toContain("arviointisuunnitelma")
  })

  it("muotoilee paivan suomeksi ilman etunollia", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, oasPvm: "2026-01-05" })
    expect(k).toContain("5.1.2026.")
  })

  it("ei kelpuuta kelvotonta paivaa", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, oasPvm: "20271214" })
    expect(k).not.toContain("arviointisuunnitelma")
  })

  /* Pelkka kunta ei ole kuvaus. */
  it("palauttaa nullin kun tunnusta eika nimea ole", () => {
    expect(kaavanPeruskuvaus({ ...PERINTOTIE, kaavaTunnus: null, nimi: null })).toBeNull()
    expect(kaavanPeruskuvaus({ ...PERINTOTIE, kaavaTunnus: "  ", nimi: "" })).toBeNull()
  })

  it("toimii ilman tunnusta kun nimi on", () => {
    const k = kaavanPeruskuvaus({ ...PERINTOTIE, kaavaTunnus: null, nimi: "Jaalakuja" })
    expect(k).toBe(
      "Kaavahanke, Vantaa. Kohde Jaalakuja. Vaihe: Vireilletullut. " +
        "Osallistumis- ja arviointisuunnitelma 14.12.2027."
    )
  })
})
