import { describe, expect, it } from "vitest"

import { regionFromOrganisationName, regionFromPublicBodyName } from "./regionFromName"

describe("regionFromOrganisationName", () => {
  /* Mitattu rivi: jonossa oleva Hilma-ilmoitus ilman kuntaa. */
  it("lukee maakunnan tilaajan nimesta", () => {
    expect(regionFromOrganisationName("Pohjois-Karjalan hankintatoimi")).toBe("Pohjois-Karjala")
    expect(regionFromOrganisationName("Varsinais-Suomen ELY-keskus")).toBe("Varsinais-Suomi")
    expect(regionFromOrganisationName("Pirkanmaan sairaanhoitopiiri")).toBe("Pirkanmaa")
  })

  /* Saannottomat genetiivit ovat taulukossa, eivat paattelyssa. */
  it("osaa saannottomat taivutukset", () => {
    expect(regionFromOrganisationName("Uudenmaan liitto")).toBe("Uusimaa")
    expect(regionFromOrganisationName("Lapin hyvinvointialue")).toBe("Lappi")
    expect(regionFromOrganisationName("Satakunnan sairaanhoitopiiri")).toBe("Satakunta")
    expect(regionFromOrganisationName("Kanta-Hämeen hyvinvointialue")).toBe("Kanta-Häme")
  })

  /* Pisin nimi ensin: Pohjanmaa ei saa voittaa Pohjois-Pohjanmaata. */
  it("ei sekoita samankaltaisia maakuntia", () => {
    expect(regionFromOrganisationName("Pohjois-Pohjanmaan hyvinvointialue")).toBe("Pohjois-Pohjanmaa")
    expect(regionFromOrganisationName("Etelä-Pohjanmaan ELY-keskus")).toBe("Etelä-Pohjanmaa")
    expect(regionFromOrganisationName("Pohjanmaan liitto")).toBe("Pohjanmaa")
  })

  it("palauttaa null kun nimi ei kerro maakuntaa", () => {
    expect(regionFromOrganisationName("Senaatti-kiinteistöt")).toBeNull()
    expect(regionFromOrganisationName("YIT Oyj")).toBeNull()
    expect(regionFromOrganisationName("")).toBeNull()
    expect(regionFromOrganisationName(null)).toBeNull()
  })
})

describe("regionFromPublicBodyName", () => {
  /*
   * Mitattu rivi: Hilman ilmoitus ilman kuntaa, tilaajana kahden
   * kunnan hyvinvointialue.
   */
  it("lukee maakunnan usean kunnan julkisyhteisosta", () => {
    expect(regionFromPublicBodyName("Vantaan ja Keravan hyvinvointialue")).toBe("Uusimaa")
    expect(regionFromPublicBodyName("Espoon seurakuntayhtymä")).toBe("Uusimaa")
    expect(regionFromPublicBodyName("Jyväskylän yliopisto")).toBe("Keski-Suomi")
  })

  /*
   * Yritys voi kantaa kunnan nimea olematta siella: "Savon Voima Verkko
   * Oy" osuu Savonlinnaan mutta toimii Pohjois-Savossa. Oikeusmuoto on
   * siksi pakko tarkistaa.
   */
  it("ei paattele yrityksesta eika yhdistyksesta", () => {
    expect(regionFromPublicBodyName("Savon Voima Verkko Oy")).toBeNull()
    expect(regionFromPublicBodyName("Helsingin Vihreät ry")).toBeNull()
    expect(regionFromPublicBodyName("Tampereen Kulttuurikamari Oy")).toBeNull()
  })

  it("ei paattele kun kunnat ovat eri maakunnissa", () => {
    expect(regionFromPublicBodyName("Turun ja Tampereen kaupungit")).toBeNull()
  })

  it("palauttaa null kun kuntaa ei ole nimessa", () => {
    expect(regionFromPublicBodyName("Senaatti-kiinteistöt")).toBeNull()
    expect(regionFromPublicBodyName("")).toBeNull()
    expect(regionFromPublicBodyName(null)).toBeNull()
  })
})
