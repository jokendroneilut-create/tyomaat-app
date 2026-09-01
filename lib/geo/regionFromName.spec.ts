import { describe, expect, it } from "vitest"

import { regionFromOrganisationName } from "./regionFromName"

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
