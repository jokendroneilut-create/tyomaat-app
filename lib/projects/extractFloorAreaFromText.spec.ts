import { describe, expect, it } from "vitest"

import { extractFloorAreaFromText, parseAlaTeksti } from "./extractFloorAreaFromText"

/*
 * Jokainen tapaus on luettu kannasta 5.9.2026, ei keksitty. Torjuttavat
 * ovat yhtä tärkeitä kuin poimittavat: väärä ala on asiakkaalle näkyvä
 * luku hankkeen koosta.
 */
describe("extractFloorAreaFromText", () => {
  describe("poimii rakennuksen alan", () => {
    it("lukee brm2:n ilman lause-ankkuria", () => {
      expect(
        extractFloorAreaFromText("yksikerroksinen palvelukeskus on noin 1 700 brm².")
      ).toBe(1700)
      expect(extractFloorAreaFromText("toteutettavan rakennuksen koko on noin 4 200 brm².")).toBe(
        4200
      )
    })

    it("lukee bruttoalan", () => {
      expect(
        extractFloorAreaFromText("Koko hankkeen bruttoala on 4 604 m². Asuntojen vuokrat…")
      ).toBe(4604)
    })

    it("lukee ruotsinkielisen bruttoytan", () => {
      expect(
        extractFloorAreaFromText("enligt vilken projektet omfattar cirka 2 260 m² bruttoyta och")
      ).toBe(2260)
    })

    it("lukee hankkeen laajuuden", () => {
      expect(extractFloorAreaFromText("että hankkeen laajuus on 3 745 m² ja rakentaminen")).toBe(
        3745
      )
    })

    it("lukee kerrosalan ja kokonaispinta-alan", () => {
      expect(extractFloorAreaFromText("Rakennusten kokonaiskerrosala on 3 600 m², ja kohde")).toBe(
        3600
      )
      expect(
        extractFloorAreaFromText("Laitoksen kokonaispinta-ala on noin 600 neliömetriä.")
      ).toBe(600)
    })
  })

  describe("ei poimi muuta kuin rakennusta", () => {
    it("ei lue maa-alaa", () => {
      expect(
        extractFloorAreaFromText("Suunnittelualueen pinta-ala on 10 300 m². Puistosuunnitelma")
      ).toBeNull()
      expect(extractFloorAreaFromText("Puiston pinta-ala on 24 400 m².")).toBeNull()
      expect(
        extractFloorAreaFromText("Länsiulapanniemen ranta-alueen pinta-ala on 58 000 m².")
      ).toBeNull()
    })

    it("ei lue rakennusoikeutta", () => {
      expect(
        extractFloorAreaFromText("Tontin rakennusoikeus on 9 600 m², joten kerrosluku")
      ).toBeNull()
    })

    it("ei lue kerroksen tai katon alaa", () => {
      expect(
        extractFloorAreaFromText("Uuden tallin ensimmäisen kerroksen pohjapinta-ala on 191 m².")
      ).toBeNull()
      expect(
        extractFloorAreaFromText("Uusittavan kattoalueen kokonaispinta-ala on noin 1100 m2.")
      ).toBeNull()
    })

    it("ei lue asunnon kokoa", () => {
      expect(
        extractFloorAreaFromText("Asuntojen keskipinta-ala on 54,5 m2. Kodit ovat")
      ).toBeNull()
      expect(
        extractFloorAreaFromText("leikkipuisto, kooltaan noin 6 300 m². Puistossa")
      ).toBeNull()
    })

    it("ei lue jarjettoman pienta eika suurta", () => {
      expect(extractFloorAreaFromText("varasto on 5 brm²")).toBeNull()
      expect(extractFloorAreaFromText("alue on 900 000 brm²")).toBeNull()
    })

    it("kestaa tyhjan", () => {
      expect(extractFloorAreaFromText(null)).toBeNull()
      expect(extractFloorAreaFromText("")).toBeNull()
      expect(extractFloorAreaFromText("Ei mitaan lukuja tassa tekstissa.")).toBeNull()
    })
  })
})
/*
 * Lupapisteen kuulutus-PDF:n lomakekentta. Arvot ovat kannasta
 * 6.9.2026 - PDF-jasennys rikkoo valilyonnit vaihtelevasti.
 */
describe("parseAlaTeksti", () => {
  it("lukee kentan arvon vaikka yksikko on hajalla", () => {
    expect(parseAlaTeksti("96 m 2")).toBe(96)
    expect(parseAlaTeksti("182 m²")).toBe(182)
    expect(parseAlaTeksti("91m 2")).toBe(91)
    expect(parseAlaTeksti("1471 m 2")).toBe(1471)
    expect(parseAlaTeksti("1 747 m²")).toBe(1747)
    expect(parseAlaTeksti("19834 m 2")).toBe(19834)
  })

  /* Sama alaraja kuin tekstipoimijassa: vaja ei ole hanke. */
  it("ei lue jarjettoman pienta", () => {
    expect(parseAlaTeksti("14 m 2")).toBeNull()
  })

  it("kestaa tyhjan ja lukuun kelpaamattoman", () => {
    expect(parseAlaTeksti(null)).toBeNull()
    expect(parseAlaTeksti("")).toBeNull()
    expect(parseAlaTeksti("ei ilmoitettu")).toBeNull()
    expect(parseAlaTeksti("500 m3")).toBeNull()
  })
})
