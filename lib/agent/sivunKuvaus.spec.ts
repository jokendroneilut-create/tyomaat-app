import { describe, expect, it } from "vitest"

import {
  onNavigaatiota,
  puhuukoRakentamisesta,
  rajaaPituus,
  siistiAlku,
} from "./sivunKuvaus"

/*
 * Kaikki tapaukset ovat luettuja rivejä kuivaharjoituksista
 * 11.-12.10.2026 (D-272, D-273).
 */
describe("onNavigaatiota", () => {
  it("tunnistaa Dynasty-sivun valikon", () => {
    expect(
      onNavigaatiota(
        "Dynasty tietopalvelu Siirry suoraan pääsisältöön Kouvolan kaupunki RSS Haku RSS-linkki"
      )
    ).toBe(true)
  })

  it("tunnistaa latausvirheen paatossivulla", () => {
    expect(
      onNavigaatiota("Virhe päätöstä ladattaessa Something went wrong loading decision. Try again.")
    ).toBe(true)
  })

  it("paastaa tiedotteen lapi", () => {
    expect(
      onNavigaatiota(
        "Hartela rakentaa TA-Yhtiöille kaksi asumisoikeuskerrostaloa Järvenpäähän ja Lahteen."
      )
    ).toBe(false)
  })
})

describe("puhuukoRakentamisesta", () => {
  it("hylkaa sivun jolla ei puhuta rakentamisesta", () => {
    expect(
      puhuukoRakentamisesta(
        "Kaupungintalon liputuskäytännöt Kouvolan kaupungintalon lipputankoja on 3 kpl ja niiden korkeus on 14 m."
      )
    ).toBe(false)
  })

  it("hylkaa myynti-ilmoituslistauksen", () => {
    expect(
      puhuukoRakentamisesta(
        "Myytävät kerrostaloasunnot Westend, Espoo: 86 kpl Hakuehdot: Westend, Espoo. Alueella rakennetaan paljon."
      )
    ).toBe(false)
  })

  it("hyvaksyy rakennushankkeen", () => {
    expect(
      puhuukoRakentamisesta(
        "Solarigo Systems Oy selvittää edellytyksiä aurinkosähköpuiston rakentamiseksi Mäntyharjulle."
      )
    ).toBe(true)
  })
})

describe("siistiAlku", () => {
  it("poistaa kategorialinkit", () => {
    expect(
      siistiAlku("Ajankohtaista Rakentaminen Toimitilarakentaminen Fira Oy ja Tokmanni ovat sopineet")
    ).toBe("Fira Oy ja Tokmanni ovat sopineet")
  })

  it("EI poista sanaa joka aloittaa virkkeen", () => {
    const teksti = "Rakentaminen on alkanut maaliskuussa 2025, ja kohde valmistuu 2026."
    expect(siistiAlku(teksti)).toBe(teksti)
  })

  it("poistaa murupolun", () => {
    expect(siistiAlku("Etusivu > Ajankohtaista > Tiedotteet > NCC rakentaa kerrostalon")).toContain(
      "NCC rakentaa"
    )
  })
})

describe("rajaaPituus", () => {
  it("katkaisee virkkeen rajalta", () => {
    const pitka = "Kohde rakennetaan Espooseen. ".repeat(120)
    const tulos = rajaaPituus(pitka)
    expect(tulos.length).toBeLessThanOrEqual(1500)
    expect(tulos.endsWith(".")).toBe(true)
  })
})
