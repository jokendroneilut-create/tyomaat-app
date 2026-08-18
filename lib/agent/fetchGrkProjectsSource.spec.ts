import { describe, it, expect } from "vitest"
import { grkMentionsFutureYear, isFinnishGrkProject } from "./fetchGrkProjectsSource"

describe("grkMentionsFutureYear", () => {
  /*
   * Sivuilla ei ole tilakenttää, joten vuosi on ainoa merkki. Mitattu
   * 19.8.2026: 239 sivusta vain 40 mainitsee vuoden 2026 tai myöhemmän.
   */
  it("tunnistaa käynnissä olevan tulevasta vuodesta", () => {
    expect(grkMentionsFutureYear("Urakka valmistuu vuonna 2027.", 2026)).toBe(true)
    expect(grkMentionsFutureYear("Hanke toteutettiin 2018–2019.", 2026)).toBe(false)
  })

  /* Kaukainen vuosiluku on yleensä tavoitevuosi, ei rakennusaika. */
  it("ohittaa epäuskottavan kaukaiset vuodet", () => {
    expect(grkMentionsFutureYear("Tavoite hiilineutraalius 2040.", 2026)).toBe(false)
  })

  it("palauttaa epätoden ilman vuosilukuja", () => {
    expect(grkMentionsFutureYear("Urakkaan kuuluu sillan rakentaminen.", 2026)).toBe(false)
  })
})

describe("isFinnishGrkProject", () => {
  /*
   * GRK toimii myös Ruotsissa, Virossa ja Liettuassa. Virolainen
   * ratahanke pääsi läpi, koska kaupunkitunnistin luki sanasta "loppuun"
   * kunnan Loppi — se korjattiin detectCityFromTextissä.
   */
  it("hyväksyy suomalaisen kohteen", () => {
    expect(isFinnishGrkProject("Turun raitiotien rakentaminen")).toBe(true)
  })

  it("hylkää ulkomaisen kohteen", () => {
    expect(
      isFinnishGrkProject(
        "Virossa on noin 1200 kilometrin rataverkosto, joka sähköistetään vuoden 2028 loppuun mennessä."
      )
    ).toBe(false)
  })
})
