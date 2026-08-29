import { describe, expect, it } from "vitest"
import * as cheerio from "cheerio"

import {
  blockText,
  cutAtFirstMarker,
  parseScopeFromText,
  trimDanglingLabel,
  trimTrailingHeadings,
} from "./htmlBlockText"

describe("blockText", () => {
  /*
   * Cheerion .text() liittaa elementit ilman erotinta. Sama vika osui
   * kahteen eri lahteeseen 29.8.2026.
   */
  it("erottaa lohkot valilyonnilla", () => {
    const $ = cheerio.load("<h1>Wärtsilä STH HUB Extension</h1><p>Lujatalo toteuttaa laajennuksen.</p>")
    expect(blockText($)).toBe("Wärtsilä STH HUB Extension Lujatalo toteuttaa laajennuksen.")
  })

  it("pudottaa pelkat osoitteet", () => {
    const $ = cheerio.load(
      "<p>Hanke etenee.</p><p>https://www.lujatalo.fi/ajankohtaista/juttu</p><p>https://www.lujatalo.fi/toinen</p>"
    )
    expect(blockText($)).toBe("Hanke etenee.")
  })

  it("sailyttaa tekstin jossa on linkki mukana", () => {
    const $ = cheerio.load("<p>Lisätietoja: https://esimerkki.fi sivulla.</p>")
    expect(blockText($)).toContain("Lisätietoja")
  })
})

describe("cutAtFirstMarker", () => {
  /* Skanskan sivun hantaan jaa maavalitsin ja karttaupotus. */
  it("katkaisee ensimmaisesta merkista", () => {
    expect(
      cutAtFirstMarker("Hanke valmistuu 2028. Valitse maa Europe Finland", /(Valitse maa|Aktivoi kartta)/i)
    ).toBe("Hanke valmistuu 2028.")
  })

  it("ei katkaise jos merkkia ei ole", () => {
    expect(cutAtFirstMarker("Hanke valmistuu 2028.", /(Valitse maa)/i)).toBe("Hanke valmistuu 2028.")
  })

  /* Merkki heti alussa tarkoittaisi tyhjaa kuvausta - ei katkaista. */
  it("ei tyhjenna kuvausta kokonaan", () => {
    expect(cutAtFirstMarker("Valitse maa Europe", /(Valitse maa)/i)).toBe("Valitse maa Europe")
  })
})

describe("trimTrailingHeadings", () => {
  it("karsii roikkuvat otsikot lopusta", () => {
    expect(trimTrailingHeadings("Talotekniikka tuo elämän. Kuvia Sijainti")).toBe(
      "Talotekniikka tuo elämän."
    )
  })

  it("ei koske tekstiin jossa sana on lauseessa", () => {
    expect(trimTrailingHeadings("Kohteen sijainti on Pasilassa.")).toBe(
      "Kohteen sijainti on Pasilassa."
    )
  })
})

describe("trimDanglingLabel", () => {
  it("karsii kaksoispisteeseen paattyvan katkelman", () => {
    expect(
      trimDanglingLabel("Koulutuskeskus valmistui 2025. Lisää yhteistyöhankkeista Wärtsilän kanssa:")
    ).toBe("Koulutuskeskus valmistui 2025.")
  })

  it("ei koske tavalliseen loppuun", () => {
    expect(trimDanglingLabel("Hanke valmistuu 2028.")).toBe("Hanke valmistuu 2028.")
  })
})

describe("parseScopeFromText", () => {
  it("lukee bruttoneliot leipatekstista", () => {
    expect(parseScopeFromText("Hankkeen laajuus on noin 11 000 bruttoneliömetriä.")).toBe(
      "11 000 bruttoneliömetriä"
    )
  })

  /* Sama ansa kuin asuntosaatiopoimijassa: luku ei saa hypata yli. */
  it("ei hyppaa kahden luvun yli", () => {
    expect(parseScopeFromText("vuonna 2028 valmistuu 11 000 bruttoneliömetriä")).toBe(
      "11 000 bruttoneliömetriä"
    )
  })

  it("palauttaa nullin kun lukua ei ole", () => {
    expect(parseScopeFromText("ei laajuutta mainittu")).toBeNull()
    expect(parseScopeFromText("")).toBeNull()
  })
})
