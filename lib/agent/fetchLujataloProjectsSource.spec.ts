import { describe, it, expect } from "vitest"
import { parseLujataloCard, parseMillionEuros } from "./fetchLujataloProjectsSource"

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
