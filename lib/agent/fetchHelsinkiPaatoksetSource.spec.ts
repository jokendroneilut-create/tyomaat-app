import { describe, it, expect } from "vitest"
import {
  inferPhase,
  shouldExclude,
  toIsoDate,
} from "./fetchHelsinkiPaatoksetSource"

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

describe("toIsoDate", () => {
  /*
   * PAATOSPAIVA ON MITATTAVUUDEN EHTO. Ahjon meeting_date on unix-sekunteina,
   * mutta aineistossa esiintyy myos ISO-merkkijono. Vaara paatospaiva olisi
   * pahempi kuin puuttuva: sen perusteella hanke voitaisiin todeta
   * vanhentuneeksi ja piilottaa asiakkaalta.
   */
  it("lukee unix-sekunnit", () => {
    expect(toIsoDate(1621209600)).toBe("2021-05-17")
  })

  it("lukee unix-millisekunnit", () => {
    expect(toIsoDate(1621209600000)).toBe("2021-05-17")
  })

  it("lukee ISO-merkkijonon", () => {
    expect(toIsoDate("2021-05-17T09:00:00Z")).toBe("2021-05-17")
    expect(toIsoDate("2021-05-17")).toBe("2021-05-17")
  })

  it("lukee numeron merkkijonona", () => {
    expect(toIsoDate("1621209600")).toBe("2021-05-17")
  })

  it("palauttaa null kelvottomasta", () => {
    expect(toIsoDate(null)).toBeNull()
    expect(toIsoDate(undefined)).toBeNull()
    expect(toIsoDate("")).toBeNull()
    expect(toIsoDate("eilen")).toBeNull()
    expect(toIsoDate(NaN)).toBeNull()
  })
})
