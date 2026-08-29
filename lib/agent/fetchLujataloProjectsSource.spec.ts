import { describe, it, expect } from "vitest"
import {
  parseLujataloCard,
  parseLujataloSchedule,
  parseMillionEuros,
} from "./fetchLujataloProjectsSource"

/*
 * Kortin teksti sellaisena kuin cheerio sen tuottaa: kaupunki, viiva,
 * tila ja otsikko peräkkäin ilman luotettavia erottimia.
 */
describe("parseLujataloCard", () => {
  it("lukee kaupungin ja käynnissä olevan tilan", () => {
    const card = parseLujataloCard(
      "Lahti – Rakentaminen käynnissä Päijät-Hämeen keskussairaalan rakennusvaihe 8"
    )
    expect(card.city).toBe("Lahti")
    expect(card.ongoing).toBe(true)
  })

  /*
   * Pelkkä vuosiluku tarkoittaa valmistunutta referenssiä. Sivusto erottaa
   * nämä itse, joten vaihetta ei tarvitse arvata tekstistä.
   */
  it("tulkitsee pelkän vuosiluvun valmistuneeksi", () => {
    const card = parseLujataloCard("Vaasa – 2026 Wärtsilä Office 26")
    expect(card.city).toBe("Vaasa")
    expect(card.ongoing).toBe(false)
  })
})

describe("parseMillionEuros", () => {
  it("muuntaa miljoonat euroiksi", () => {
    expect(parseMillionEuros("71 M€")).toBe(71_000_000)
    expect(parseMillionEuros("16,5 M€")).toBe(16_500_000)
  })

  /* Tuntematon muoto jätetään mieluummin tyhjäksi kuin arvataan. */
  it("palauttaa nullin muusta muodosta", () => {
    expect(parseMillionEuros("noin 70 miljoonaa")).toBeNull()
    expect(parseMillionEuros("8799 brm2")).toBeNull()
  })
})

describe("parseLujataloSchedule", () => {
  /*
   * Listasivu merkitsi "Varkauden Sote-keskuksen" kaynnissa olevaksi,
   * vaikka kohdesivulla lukee "Rakentamisen aikataulu 2019 - 2021".
   * Valmis kohde tuli jonoon rakenteilla olevana.
   */
  it("lukee vuosivalin", () => {
    expect(parseLujataloSchedule("2019 - 2021")).toEqual({ start: 2019, end: 2021 })
    expect(parseLujataloSchedule("2024-2026")).toEqual({ start: 2024, end: 2026 })
  })

  it("osaa ajatusviivan", () => {
    expect(parseLujataloSchedule("2024–2026")).toEqual({ start: 2024, end: 2026 })
    expect(parseLujataloSchedule("2024—2026")).toEqual({ start: 2024, end: 2026 })
  })

  /* Avoimesta lopusta ei voi paatella valmistumista. */
  it("hylkaa avoimen lopun ja kelvottoman", () => {
    for (const paha of ["2025-", "2025", "kevat 2026", "", null, undefined]) {
      expect(parseLujataloSchedule(paha as any)).toBeNull()
    }
  })

  /* Kaanteinen vali on kirjoitusvirhe, ei tieto. */
  it("hylkaa kaanteisen valin", () => {
    expect(parseLujataloSchedule("2026 - 2019")).toBeNull()
  })
})
