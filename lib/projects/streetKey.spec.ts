import { describe, it, expect } from "vitest"
import { streetKey, haveSameStreetAddress } from "./streetKey"

describe("streetKey", () => {
  /*
   * Mitattu tapaus 21.8.2026: Herttoniemen kirkon purku oli kannassa
   * kahdesti, ja ainoa ero oli osoitteen kirjoitusasu.
   */
  it("antaa saman avaimen saman rakennuksen eri kirjoitusasuille", () => {
    expect(streetKey("Osoite Hiihtomäentie 23, 00800 Helsinki")).toBe("hiihtomäentie 23")
    expect(streetKey("Hiihtomäentie 23, Helsinki")).toBe("hiihtomäentie 23")
    expect(streetKey("Hiihtomäentie 23")).toBe("hiihtomäentie 23")
  })

  it("sivuuttaa talonumeron kirjainosan", () => {
    expect(streetKey("Gummeruksenkatu 4 a, 40100 Jyväskylä")).toBe("gummeruksenkatu 4")
    expect(streetKey("Gummeruksenkatu 4a")).toBe("gummeruksenkatu 4")
  })

  it("ottaa numerovälistä ensimmäisen", () => {
    expect(streetKey("Raatihuoneenkatu 12-14, 13100 Hämeenlinna")).toBe("raatihuoneenkatu 12")
  })

  /*
   * Ilman talonumeroa avain osuisi kaikkiin saman alueen hankkeisiin,
   * joten se jätetään antamatta.
   */
  it("ei anna avainta ilman talonumeroa", () => {
    expect(streetKey("Helsinki")).toBeNull()
    expect(streetKey("Herttoniemi")).toBeNull()
    expect(streetKey("Notkolantie")).toBeNull()
    expect(streetKey("Kaupungintalo")).toBeNull()
  })

  it("ei anna avainta postilokerosta", () => {
    expect(streetKey("PL 125, 76100 Pieksämäki")).toBeNull()
    expect(streetKey("PL 630 20101 Turku FIN")).toBeNull()
  })

  it("kestää tyhjän", () => {
    expect(streetKey(null)).toBeNull()
    expect(streetKey("")).toBeNull()
  })

  /*
   * Osoite voi olla keskellä lausetta, kun se on poimittu kuvaustekstistä.
   */
  it("löytää osoitteen lauseen keskeltä", () => {
    expect(
      streetKey("Urakka-alue sijaitsee Oulussa osoitteessa Ruskonniityntie 10, 90620 Oulu")
    ).toBe("ruskonniityntie 10")
  })
})

describe("haveSameStreetAddress", () => {
  it("tunnistaa saman osoitteen eri muodoissa", () => {
    expect(
      haveSameStreetAddress("Osoite Hiihtomäentie 23, 00800 Helsinki", "Hiihtomäentie 23, Helsinki")
    ).toBe(true)
  })

  it("erottaa eri talonumerot", () => {
    expect(haveSameStreetAddress("Hiihtomäentie 23", "Hiihtomäentie 25")).toBe(false)
  })

  /* Tyhjä avain ei saa osua toiseen tyhjään. */
  it("ei osu kun kummallakaan ei ole avainta", () => {
    expect(haveSameStreetAddress("Helsinki", "Helsinki")).toBe(false)
    expect(haveSameStreetAddress(null, null)).toBe(false)
  })
})
