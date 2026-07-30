import { describe, it, expect } from "vitest"
import {
  getMunicipalityByPlaceName,
  municipalityFromGenitive,
  municipalityFromBuyerName,
  isCityCorroboratedByText,
} from "./municipalityFromName"

describe("municipalityFromGenitive", () => {
  it("tunnistaa säännöllisen genetiivin", () => {
    expect(municipalityFromGenitive("Janakkalan")?.name).toBe("Janakkala")
    expect(municipalityFromGenitive("Raaseporin")?.name).toBe("Raasepori")
    expect(municipalityFromGenitive("Nokian")?.name).toBe("Nokia")
    expect(municipalityFromGenitive("Vantaan")?.name).toBe("Vantaa")
  })

  it("tunnistaa vartalonmuutokset yhteisen alun perusteella", () => {
    expect(municipalityFromGenitive("Helsingin")?.name).toBe("Helsinki")
    expect(municipalityFromGenitive("Riihimäen")?.name).toBe("Riihimäki")
    expect(municipalityFromGenitive("Tampereen")?.name).toBe("Tampere")
    expect(municipalityFromGenitive("Lappeenrannan")?.name).toBe("Lappeenranta")
    expect(municipalityFromGenitive("Seinäjoen")?.name).toBe("Seinäjoki")
    expect(municipalityFromGenitive("Kirkkonummen")?.name).toBe("Kirkkonummi")
  })

  it("tunnistaa lyhyet poikkeukset", () => {
    expect(municipalityFromGenitive("Turun")?.name).toBe("Turku")
    expect(municipalityFromGenitive("Lahden")?.name).toBe("Lahti")
  })

  it("palauttaa maakunnan kunnan mukana", () => {
    expect(municipalityFromGenitive("Janakkalan")?.region).toBe("Kanta-Häme")
  })

  it("ei arvaa tuntemattomasta sanasta", () => {
    expect(municipalityFromGenitive("Rakennusliikkeen")).toBeNull()
    expect(municipalityFromGenitive("Kiinteistön")).toBeNull()
    expect(municipalityFromGenitive(null)).toBeNull()
    expect(municipalityFromGenitive("")).toBeNull()
  })

  it("vaatii genetiivin, ei osu perusmuotoon", () => {
    expect(municipalityFromGenitive("Janakkala")).toBeNull()
  })
})

describe("municipalityFromBuyerName", () => {
  it("poimii kunnan tilaajan nimestä", () => {
    expect(municipalityFromBuyerName("Janakkalan kunta")?.name).toBe("Janakkala")
    expect(municipalityFromBuyerName("Nokian kaupunki")?.name).toBe("Nokia")
    expect(
      municipalityFromBuyerName("Helsingin kaupunki, kaupunkiympäristön toimiala")
        ?.name
    ).toBe("Helsinki")
  })

  it("löytää kunnan myös nimen keskeltä", () => {
    expect(
      municipalityFromBuyerName(
        "Stara (Helsingin kaupungin rakentamispalveluliikelaitos)"
      )?.name
    ).toBe("Helsinki")
  })

  it("ei osu kuntayhtymään, joka kattaa useita kuntia", () => {
    expect(municipalityFromBuyerName("Etelä-Savon kuntayhtymä")).toBeNull()
  })

  it("ei osu yrityksiin eikä valtakunnallisiin toimijoihin", () => {
    expect(municipalityFromBuyerName("Kiinteistökehitys Naistinki Oy")).toBeNull()
    expect(municipalityFromBuyerName("Väylävirasto")).toBeNull()
    expect(municipalityFromBuyerName(null)).toBeNull()
  })
})

describe("getMunicipalityByPlaceName", () => {
  it("tunnistaa kunnan suoraan", () => {
    expect(getMunicipalityByPlaceName("Janakkala")?.name).toBe("Janakkala")
  })

  it("tunnistaa postitoimipaikan joka ei ole kunta", () => {
    expect(getMunicipalityByPlaceName("Turenki")?.name).toBe("Janakkala")
    expect(getMunicipalityByPlaceName("Turenki")?.region).toBe("Kanta-Häme")
  })

  it("tunnistaa kylät ja kuntaliitoksessa hävinneet nimet", () => {
    expect(getMunicipalityByPlaceName("Ivalo")?.name).toBe("Inari")
    expect(getMunicipalityByPlaceName("Onttola")?.name).toBe("Kontiolahti")
    expect(getMunicipalityByPlaceName("Immola")?.name).toBe("Imatra")
    expect(getMunicipalityByPlaceName("Nauvo")?.name).toBe("Parainen")
  })

  it("ei tunnista tuntematonta paikkaa", () => {
    expect(getMunicipalityByPlaceName("Mordor")).toBeNull()
    expect(getMunicipalityByPlaceName(null)).toBeNull()
  })
})

describe("isCityCorroboratedByText", () => {
  it("hyväksyy taivutetun muodon tekstistä", () => {
    expect(isCityCorroboratedByText("Orivesi", "työ tehdään Orivedellä")).toBe(true)
    expect(
      isCityCorroboratedByText("Janakkala", null, "Janakkalan kunnan tekninen")
    ).toBe(true)
  })

  it("hylkää kun teksti ei mainitse kaupunkia", () => {
    expect(isCityCorroboratedByText("Vantaa", "urakka Turussa")).toBe(false)
    expect(isCityCorroboratedByText("Vantaa", null, undefined)).toBe(false)
  })
})
