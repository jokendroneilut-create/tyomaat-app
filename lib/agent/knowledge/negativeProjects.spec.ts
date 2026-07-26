import { describe, it, expect } from "vitest"
import { isSmallPrivateProject } from "./negativeProjects"

describe("isSmallPrivateProject", () => {
  it("tunnistaa vapaa-ajan asunnot ja muut pienet yksityiskohteet", () => {
    expect(
      isSmallPrivateProject("Rakentamislupa: Vapaa-ajanasuinrakennus, omaan käyttöön. Aloitusoikeus")
    ).toBe(true)
    expect(isSmallPrivateProject("Rakentamislupa: 45 k-m2 vapaa-ajan asunto")).toBe(true)
    expect(isSmallPrivateProject("Loma-asunnon rakentaminen, Haruniementie 103")).toBe(true)
    expect(isSmallPrivateProject("Omakotitalon rakentaminen")).toBe(true)
    expect(isSmallPrivateProject("Autotallin rakentaminen")).toBe(true)
  })

  it("ei suodata isoja hankkeita", () => {
    expect(isSmallPrivateProject("Kerrostalon rakentaminen, 82 vuokra-asuntoa")).toBe(false)
    expect(isSmallPrivateProject("Päiväkodin ja alakoulun rakentaminen")).toBe(false)
    expect(isSmallPrivateProject("Maalämpöjärjestelmä")).toBe(false)
    expect(isSmallPrivateProject("Hoivakodin rakentaminen")).toBe(false)
  })

  it("sietää tyhjän syötteen", () => {
    expect(isSmallPrivateProject(null)).toBe(false)
    expect(isSmallPrivateProject(undefined)).toBe(false)
    expect(isSmallPrivateProject("")).toBe(false)
  })
})
