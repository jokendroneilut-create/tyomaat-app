import { describe, it, expect } from "vitest"
import { resolveDeveloper } from "./fetchSttHakuSource"

describe("resolveDeveloper", () => {
  it("käyttää julkaisijaa kun se on yritys", () => {
    expect(resolveDeveloper("Skanska Oy", "Uusi toimitalo Espooseen", null)).toBe(
      "Skanska Oy"
    )
  })

  /*
   * Viranomainen tiedottaa muiden hankkeista, joten julkaisija ei kelpaa
   * rakennuttajaksi. Mitattu tapaus tuotannosta: 9 ehdokasta sai
   * rakennuttajaksi "Lupa- ja valvontavirasto".
   */
  it("ei ota viranomaista rakennuttajaksi vaan poimii toteuttajan tekstistä", () => {
    const developer = resolveDeveloper(
      "Lupa- ja valvontavirasto",
      "Bull Team Oy:n ja WeKas Oy:n laajennuksen YVA-menettely käynnistyy Toholammilla",
      "Bull Team Oy ja WeKas Oy on toimittanut Lupa- ja valvontavirastolle ympäristövaikutusten arviointiohjelman."
    )

    expect(developer).toContain("Bull Team Oy")
    expect(developer).toContain("WeKas Oy")
    expect(developer).not.toContain("valvontavirasto")
  })

  it("jättää tyhjäksi kun viranomaisen tiedotteesta ei löydy yritystä", () => {
    expect(
      resolveDeveloper(
        "Lupa- ja valvontavirasto",
        "Uusiutuvan energian nopean kehittämisen alueiden nimeämismenettely",
        "Kuulutus on nähtävillä."
      )
    ).toBeNull()
  })

  it("tunnistaa viranomaisen eri kirjoitusasuissa", () => {
    for (const publisher of [
      "Aluehallintovirasto",
      "Pohjois-Pohjanmaan ELY-keskus",
      "Ympäristöministeriö",
    ]) {
      expect(resolveDeveloper(publisher, "Hanke käynnistyy", null)).toBeNull()
    }
  })

  /*
   * Osa virastoista on aitoja rakennuttajia, eivät lupaviranomaisia -
   * ne eivät saa pudota listalle.
   */
  it("säilyttää rakennuttajavirastot", () => {
    expect(resolveDeveloper("Väylävirasto", "Ratahanke", null)).toBe("Väylävirasto")
    expect(resolveDeveloper("Senaatti-kiinteistöt", "Toimitilahanke", null)).toBe(
      "Senaatti-kiinteistöt"
    )
  })

  it("sietää tyhjät", () => {
    expect(resolveDeveloper(null, null, null)).toBeNull()
  })
})
