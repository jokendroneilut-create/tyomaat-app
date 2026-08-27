import { describe, expect, it } from "vitest"

import { parseGranlundDescription, parseGranlundFields } from "./granlundProject"

/* Kentat ovat liimattuna yhteen ilman erottimia, kuten oikealla sivulla. */
const LOHKO =
  "Paikkakunta Seinäjoki Tilaaja Eepee Kiinteistöt Oy Tyyppi Korjausrakentaminen " +
  "Aloitus 2024 Valmistuminen 2027 Bruttoneliöt 30 000 m2 " +
  "Muut hankkeen toimijat Ramboll Finland Oy, Sustera HVAC Design Oy, Fredag Oy " +
  "Granlundin palvelut projektissa ArkkitehtisuunnitteluSähkösuunnitteluHuoltokirjakoordinointi " +
  "Katso kaikki palvelumme Tutustu muihin"

const KUVAUS =
  "Seinäjoen Hyllykallion Prisman laajennus ja uudistustyöt ovat käynnistyneet kesällä 2026. " +
  "Suunnittelu aloitettiin kesällä 2024. Toimimme hankkeessa pää- ja arkkitehtisuunnittelijoina. " +
  "Prisma Hyllykallioon rakennetaan laajennusta noin 4 000 m2."

describe("parseGranlundFields", () => {
  it("poimii kenttalohkon", () => {
    const f = parseGranlundFields(`<p>${KUVAUS}</p>${LOHKO}`)
    expect(f.city).toBe("Seinäjoki")
    expect(f.developer).toBe("Eepee Kiinteistöt Oy")
    expect(f.projectType).toBe("Korjausrakentaminen")
    expect(f.startYear).toBe(2024)
    expect(f.completionYear).toBe(2027)
    expect(f.estimatedCompletion).toBe("2027-12-31")
    expect(f.area).toBe("30 000 m2")
  })

  it("pilkkoo muut toimijat", () => {
    const f = parseGranlundFields(LOHKO)
    expect(f.otherCompanies).toEqual(["Ramboll Finland Oy", "Sustera HVAC Design Oy", "Fredag Oy"])
  })

  /* Palvelut ovat liimattuna yhteen, koska ne ovat HTML:ssa omina elementteinaan. */
  it("erottaa liimatut palvelut isosta kirjaimesta", () => {
    const f = parseGranlundFields(LOHKO)
    expect(f.granlundServices).toEqual([
      "Arkkitehtisuunnittelu",
      "Sähkösuunnittelu",
      "Huoltokirjakoordinointi",
    ])
  })

  it("kestaa puuttuvat kentat", () => {
    const f = parseGranlundFields("Paikkakunta Turku Tyyppi Uudisrakentaminen Katso kaikki palvelumme")
    expect(f.city).toBe("Turku")
    expect(f.developer).toBeNull()
    expect(f.completionYear).toBeNull()
    expect(f.estimatedCompletion).toBeNull()
  })

  it("palauttaa tyhjan kun sisaltoa ei ole", () => {
    const f = parseGranlundFields("")
    expect(f.city).toBeNull()
    expect(f.otherCompanies).toEqual([])
  })

  /* Vuosi luetaan vain nelinumeroisena; muu muoto on arvausta. */
  it("hylkaa kelvottoman vuoden", () => {
    expect(parseGranlundFields("Valmistuminen kevat").completionYear).toBeNull()
    expect(parseGranlundFields("Valmistuminen 27").completionYear).toBeNull()
  })
})

describe("parseGranlundDescription", () => {
  it("lukee kenttalohkoa EDELTAVAN tekstin", () => {
    const k = parseGranlundDescription(`<p>${KUVAUS}</p>${LOHKO}`)
    expect(k).toContain("Hyllykallion Prisman laajennus")
    expect(k).not.toContain("Paikkakunta")
    expect(k).not.toContain("Eepee")
  })

  /*
   * Lohkon jalkeen tulee "Tutustu muihin projekteihimme" -karuselli, jossa
   * on TOISTEN hankkeiden nimia - sama ansa kuin Kreatella (D-121).
   */
  it("EI lue muiden hankkeiden karusellia", () => {
    const k = parseGranlundDescription(`<p>${KUVAUS}</p>${LOHKO} Hangonsillan monitoimiareena Hyvinkää`)
    expect(k).not.toContain("Hangonsillan")
  })

  it("palauttaa nullin liian lyhyesta", () => {
    expect(parseGranlundDescription("<p>Lyhyt.</p>")).toBeNull()
    expect(parseGranlundDescription("")).toBeNull()
    expect(parseGranlundDescription(null)).toBeNull()
  })
})
