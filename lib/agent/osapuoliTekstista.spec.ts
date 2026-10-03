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

  /*
   * Mitattu 4.10.2026: "iso alkukirjain" -ehto hylkasi "wpd Suomi Oy":n
   * ja tilalle jai pelkka "Suomi".
   */
  it("lukee pienella kirjoitetun yritysnimen", () => {
    const loydot = osapuoletTekstista("wpd Suomi Oy suunnittelee tuulipuistoa Puolangalle.", [
      "wpd Suomi Oy",
      "Suomi",
    ])
    expect(loydot.map((l) => l.nimi)).toEqual(["wpd Suomi Oy"])
  })

  it("lukee lyhenteen versaalina", () => {
    expect(osapuoletTekstista("Yhteistyössä ARE:n kanssa rakennetaan.", ["Are"])[0]?.nimi).toBe("Are")
  })

  /*
   * Kaavinnan loppuosassa on valikkoja. Valikossa on substantiiveja,
   * osapuolilauseessa on tekeminen — se erottaa ne, ei sijainti.
   */
  it("ei poimi valikosta", () => {
    const valikko =
      "Asuminen ja ympäristö Avaa/sulje alavalikko Sonkakoti Oy Asuntokohteet Vapaat asunnot Tontit."
    expect(osapuoletTekstista(valikko, ["Sonkakoti Oy"])).toEqual([])
  })

  /*
   * MITATTU 4.10.2026 (Härmälänojan silta): osapuolet luetellaan vasta
   * 1 500 merkin kohdalla. Pituusrajaus olisi hukannut juuri sen lauseen
   * jonka vuoksi poimija on olemassa.
   */
  it("loytaa osapuolet myos tekstin lopusta", () => {
    const pitka =
      `${"Silta avautuu liikenteelle syksyn aikana. ".repeat(40)}` +
      "Allianssin muodostavat Tampereen kaupunki, Pirkkalan kunta ja YIT Infra."
    const nimet = osapuoletTekstista(pitka, ["Tampereen kaupunki", "Pirkkalan kunta", "YIT Infra"]).map(
      (l) => l.nimi
    )
    expect(nimet).toContain("YIT Infra")
    expect(nimet).toContain("Pirkkalan kunta")
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
