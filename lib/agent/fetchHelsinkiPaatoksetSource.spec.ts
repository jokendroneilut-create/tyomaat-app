import { describe, it, expect } from "vitest"
import { inferPhase, shouldExclude } from "./fetchHelsinkiPaatoksetSource"

describe("inferPhase", () => {
  /*
   * Kunnan päätösketju on vakiintunut: tarveselvitys -> hankesuunnitelma ->
   * toteutussuunnitelma -> urakka. Vaihe kertoo käyttäjälle kuinka lähellä
   * kilpailutus on.
   */
  it("tunnistaa ketjun vaiheet otsikosta", () => {
    expect(inferPhase("Töölön kisahallin tarveselvitys")).toBe("Suunnittelu")
    expect(
      inferPhase("Pukinmäenkaaren peruskoulun perusparannuksen hankesuunnitelma")
    ).toBe("Suunnittelussa")
    expect(inferPhase("Koulun laajennuksen urakoitsijan valinta")).toBe(
      "Sopimus myönnetty"
    )
  })

  it("olettaa suunnitteluvaiheen kun otsikko ei kerro", () => {
    expect(inferPhase("Päiväkoti Viikinki, vesikaton uusiminen")).toBe(
      "Suunnittelussa"
    )
  })
})

describe("shouldExclude", () => {
  /*
   * Kategoriasuodatus jättää läpi hallinnollisia päätöksiä. Mitattu otoksesta
   * 80 % kohinaa, ja se keskittyi näihin muotoihin.
   */
  it("pudottaa korvaus- ja lausuntopäätökset", () => {
    expect(
      shouldExclude("Tontille maksettava korvaus Niittyluhdantien rakentamisen johdosta")
    ).toBe(true)
    expect(shouldExclude("Kustannusten korvaaminen pilaantuneen maaperän osalta")).toBe(
      true
    )
    expect(shouldExclude("Aamukouluasia: Toimenpideohjelma keskusta-alueelle")).toBe(true)
  })

  /*
   * Kuvioiden on oltava tarkkoja: pelkkä "korvaus" pudottaisi myös aidon
   * hankkeen. Malli teki mitatusti juuri tämän virheen.
   */
  it("ei pudota korvaavaa uudisrakennusta", () => {
    expect(
      shouldExclude("Suutarilan kirjaston ja nuorisotilan korvaavan uudisrakennuksen hankesuunnitelma")
    ).toBe(false)
  })

  it("päästää läpi aidot hankkeet", () => {
    expect(shouldExclude("Töölön kisahallin perusparannuksen hankesuunnitelma")).toBe(
      false
    )
    expect(shouldExclude("Laajasalon raitiovaunuvarikon toteutussuunnitelma")).toBe(false)
  })
})
