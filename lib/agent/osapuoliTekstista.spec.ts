import { describe, expect, it } from "vitest"

import { kelpaakoNimi, osapuoletTekstista } from "./osapuoliTekstista"

const TUNNETUT = ["NCC", "SRV", "Fira", "Hartela", "Skanska", "Helsingin kaupunki", "Hemsö", "Helsingin", "Muu"]

describe("osapuoletTekstista", () => {
  it("loytaa tunnetun nimen tekstista", () => {
    const loydot = osapuoletTekstista("NCC käynnistää hoivakodin rakennustyöt Turussa.", TUNNETUT)
    expect(loydot.map((l) => l.nimi)).toEqual(["NCC"])
  })

  /* Rooli jaa auki kun teksti ei sita kerro — tama on koko pointti. */
  it("jattaa roolin auki kun teksti ei kerro sita", () => {
    const loydot = osapuoletTekstista("NCC käynnistää hoivakodin rakennustyöt Turussa.", TUNNETUT)
    expect(loydot[0].rooli).toBeNull()
    expect(loydot[0].lause).toContain("NCC käynnistää")
  })

  it("tunnistaa urakoitsijan kun se sanotaan", () => {
    const loydot = osapuoletTekstista("Hemsö rakennuttaa hoivakodin Turkuun, urakoitsijana NCC.", TUNNETUT)
    const ncc = loydot.find((l) => l.nimi === "NCC")
    expect(ncc?.rooli).toBe("builder")
  })

  it("tunnistaa rakennuttajan kun se sanotaan", () => {
    const loydot = osapuoletTekstista("Hemsö rakennuttaa hoivakodin Turkuun.", TUNNETUT)
    expect(loydot.find((l) => l.nimi === "Hemsö")?.rooli).toBe("developer")
  })

  /* "X rakentaa" ei erota rooleja (D-214), joten se jaa auki. */
  it("ei paattele roolia sanasta rakentaa", () => {
    expect(osapuoletTekstista("Skanska rakentaa Kuopioon asuntoja.", TUNNETUT)[0].rooli).toBeNull()
  })

  it("lukee taivutetun muodon", () => {
    expect(osapuoletTekstista("Urakka myönnettiin Firalle.", TUNNETUT)[0]?.nimi).toBe("Fira")
  })

  it("ei osu sanan sisaan", () => {
    expect(osapuoletTekstista("Areena rakennetaan Tampereelle.", ["Are"])).toEqual([])
  })

  /*
   * Mitattu kuivaharjoituksessa 3.10.2026: ilman kirjainkoon vaatimusta
   * "Varte" osui sanaan "varten" ja "Are" sanaan "areena".
   */
  it("ei osu pieneen alkukirjaimeen", () => {
    expect(osapuoletTekstista("Tarjous jätettävä sitä varten.", ["Varte"])).toEqual([])
  })

  it("lukee lyhenteen versaalina", () => {
    expect(osapuoletTekstista("Yhteistyössä ARE:n kanssa rakennetaan.", ["Are"])[0]?.nimi).toBe("Are")
  })

  /* Kaavinnan loppuosassa on valikkoja ja naapuriartikkeleita. */
  it("lukee vain alkuosan", () => {
    const pitka = `${"Hanke etenee. ".repeat(60)}Sonkakoti Oy on valikossa.`
    expect(osapuoletTekstista(pitka, ["Sonkakoti Oy"])).toEqual([])
  })

  it("sietaa tyhjan", () => {
    expect(osapuoletTekstista("", TUNNETUT)).toEqual([])
    expect(osapuoletTekstista(null, TUNNETUT)).toEqual([])
  })

  /* Sama yritys kahdessa muodossa on yksi rivi. */
  it("ei palauta samaa yritysta kahdesti", () => {
    const loydot = osapuoletTekstista("Jatke Uusimaa Oy rakentaa kohteen. Jatke aloittaa keväällä.", [
      "Jatke",
      "Jatke Uusimaa Oy",
    ])
    expect(loydot).toHaveLength(1)
    expect(loydot[0].nimi).toBe("Jatke Uusimaa Oy")
  })
})

describe("kelpaakoNimi", () => {
  /*
   * Mitattu 3.10.2026: kannassa on osapuolina "Muu", "Kiinteisto" ja
   * "Aurinko". Ne osuvat lahes mihin tahansa tekstiin.
   */
  it("hylkaa yleissanan", () => {
    expect(kelpaakoNimi("Muu")).toBe(false)
    expect(kelpaakoNimi("Kiinteistö")).toBe(false)
  })

  /* "Helsingin" osui otsikkoon "Asunto Oy Helsingin Jakomaentie 12". */
  it("hylkaa yksisanaisen kunnan nimen ja genetiivin", () => {
    expect(kelpaakoNimi("Helsingin")).toBe(false)
    expect(kelpaakoNimi("Turku")).toBe(false)
  })

  it("kelpuuttaa kunnan monisanaisena", () => {
    expect(kelpaakoNimi("Helsingin kaupunki")).toBe(true)
  })

  it("kelpuuttaa yrityksen", () => {
    expect(kelpaakoNimi("NCC")).toBe(true)
    expect(kelpaakoNimi("Pohjola Rakennus Oy")).toBe(true)
  })
})
