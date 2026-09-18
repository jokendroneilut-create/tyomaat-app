import { describe, expect, it } from "vitest"

import { kaavanRakennuttaja, onKaavalahde } from "./kaavanRakennuttaja"

describe("kaavanRakennuttaja (D-195)", () => {
  const kuvaus = "Neoen Renewables Finland Oy suunnittelee aurinkoenergian tuotantoaluetta Jämsän Kerkkolaan."

  it("poimii kaavalahteesta tyhjaan kenttaan", () => {
    expect(
      kaavanRakennuttaja({ sourceName: "Jämsän vireillä olevat asemakaavat", description: kuvaus, nykyinen: null })
    ).toBe("Neoen Renewables Finland Oy")
  })

  it("ei korvaa olemassa olevaa rakennuttajaa", () => {
    expect(
      kaavanRakennuttaja({ sourceName: "Jämsän vireillä olevat asemakaavat", description: kuvaus, nykyinen: "Jämsän kaupunki" })
    ).toBeNull()
  })

  it("ei aja uutislahteille, joissa 'toteuttaa' on usein urakoitsija", () => {
    expect(
      kaavanRakennuttaja({ sourceName: "STT Info", description: "NCC Suomi Oy toteuttaa koulun.", nykyinen: null })
    ).toBeNull()
  })

  it("tunnistaa kaavalahteet nimesta", () => {
    expect(onKaavalahde("Pyhäjoen kaavoitus")).toBe(true)
    expect(onKaavalahde("Helsingin vireillä olevat asemakaavat (SUKKA)")).toBe(true)
    expect(onKaavalahde("Kihniön tuulivoimahankkeet")).toBe(true)
    expect(onKaavalahde("Puolustuskiinteistöt uutiset")).toBe(false)
  })
})
