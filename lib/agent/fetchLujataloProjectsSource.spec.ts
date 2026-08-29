import { describe, it, expect } from "vitest"
import {
  parseLujataloCard,
  parseLujataloSchedule,
  parseMillionEuros,
  parseScopeFromText,
  blockText,
  trimDanglingLabel,
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

describe("parseScopeFromText", () => {
  /*
   * Wartsila STH HUB Extension 29.8.2026: kohdesivulla ei ollut
   * rakenteista Laajuus-kenttaa, joten luku jai kokonaan poimimatta
   * vaikka se luki leipatekstissa.
   */
  it("lukee bruttoneliot leipatekstista", () => {
    expect(
      parseScopeFromText("Hankkeen laajuus on noin 11 000 bruttoneliömetriä.")
    ).toBe("11 000 bruttoneliömetriä")
  })

  it("lukee kerrosneliot ja tavalliset neliot", () => {
    expect(parseScopeFromText("kohteessa on 4 465 neliömetriä")).toBe("4 465 neliömetriä")
    expect(parseScopeFromText("laajuus 12 000 k-m2")).toBe("12 000 k-m2")
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

describe("blockText", () => {
  /*
   * Cheerion .text() liittaa elementit ilman erotinta. Siita syntyi
   * kaksi vikaa: otsikko liimautui leipatekstiin ja linkkilista jai
   * kuvauksen loppuun.
   */
  const cheerioLoad = (html: string) => require("cheerio").load(html)

  it("erottaa lohkot valilyonnilla", () => {
    const $ = cheerioLoad("<h1>Wärtsilä STH HUB Extension</h1><p>Lujatalo toteuttaa laajennuksen.</p>")
    expect(blockText($)).toBe("Wärtsilä STH HUB Extension Lujatalo toteuttaa laajennuksen.")
  })

  it("pudottaa pelkat osoitteet", () => {
    const $ = cheerioLoad(
      "<p>Hanke etenee.</p><p>https://www.lujatalo.fi/ajankohtaista/2026/02/06/juttu</p><p>https://www.lujatalo.fi/toinen</p>"
    )
    expect(blockText($)).toBe("Hanke etenee.")
  })

  it("sailyttaa tekstin jossa on linkki mukana", () => {
    const $ = cheerioLoad("<p>Lisätietoja: https://esimerkki.fi sivulla.</p>")
    expect(blockText($)).toContain("Lisätietoja")
  })
})

describe("trimDanglingLabel", () => {
  /*
   * Linkkilistan poiston jalkeen sen otsikko jai roikkumaan kuvauksen
   * loppuun ilman itse listaa.
   */
  it("karsii kaksoispisteeseen paattyvan katkelman", () => {
    expect(
      trimDanglingLabel("Koulutuskeskus valmistui 2025. Lisää yhteistyöhankkeista Wärtsilän kanssa:")
    ).toBe("Koulutuskeskus valmistui 2025.")
  })

  it("ei koske tavalliseen loppuun", () => {
    expect(trimDanglingLabel("Hanke valmistuu 2028.")).toBe("Hanke valmistuu 2028.")
  })

  /* Kesken jaanyt lause ei ole otsikko, joten sita ei karsita. */
  it("kestaa tyhjan", () => {
    expect(trimDanglingLabel("")).toBe("")
  })
})
