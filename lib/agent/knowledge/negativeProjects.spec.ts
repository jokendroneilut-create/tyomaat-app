import { describe, it, expect } from "vitest"
import { isSmallPrivateProject, isNonProjectPermit } from "./negativeProjects"

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

describe("isNonProjectPermit", () => {
  it("osuu luvan voimassaolon jatkamiseen", () => {
    expect(isNonProjectPermit("Rakennusluvan 2023-560-A voimassaolon jatkaminen")).toBe(true)
    expect(isNonProjectPermit("Rakennusluvan jatkoaika, rakennustyön loppuunsaattaminen")).toBe(true)
  })

  it("osuu puiden kaatamiseen", () => {
    expect(isNonProjectPermit("Puiden kaataminen: Äikkäänranta 15")).toBe(true)
    expect(isNonProjectPermit("Puun kaataminen, Rastinniementie 12")).toBe(true)
  })

  it("ei osu maisematyölupaan", () => {
    /*
     * Maisematyölupa edeltää usein oikeaa hanketta (alueen raivaus),
     * joten sen pudottaminen olisi arvaus eikä mitattu sääntö.
     */
    expect(isNonProjectPermit("Maisematyölupa: Kalevantie, Rahtimiehentie")).toBe(false)
  })

  it("ei osu oikeaan rakennushankkeeseen", () => {
    expect(isNonProjectPermit("Rakentamislupa: varastohallin rakentaminen")).toBe(false)
    expect(isNonProjectPermit("TEOLLISUUSHALLI JA ALOITTAMISOIKEUS")).toBe(false)
    expect(isNonProjectPermit("Kerrostalon rakentaminen, aloitusoikeus")).toBe(false)
  })

  it("kestää tyhjän", () => {
    expect(isNonProjectPermit(null)).toBe(false)
    expect(isNonProjectPermit("")).toBe(false)
  })
})

describe("isNonProjectPermit — rakentamista valmisteleva työ", () => {
  /*
   * Aidot hankkeet kannasta 14.10.2026. Nämä ovat asiakkaalle näkyviä
   * hankkeita, eli sääntö joka pudottaa nämä pudottaa tuotantodataa.
   */
  it("ei pudota rakentamista valmistelevaa puiden kaatoa", () => {
    expect(
      isNonProjectPermit("Rakentamista valmisteleva puiden kaato tontilta, Hannusranta 12")
    ).toBe(false)
  })

  it("ei pudota samaa lupaa toisin taivutettuna", () => {
    /* Tämä muoto OLISI osunut vartaloon "puiden kaatam". */
    expect(
      isNonProjectPermit("Rakentamista valmisteleva puiden kaataminen tontilta, Hannusranta 12")
    ).toBe(false)
  })

  it("ei pudota valmistelevia maanrakennustöitä", () => {
    expect(
      isNonProjectPermit("Rakentamista valmistelevat maanrakennustyöt, Gneissitie 4 - Maisematyölupa")
    ).toBe(false)
  })

  it("pudottaa yhä pelkän puiden kaatamisen", () => {
    expect(isNonProjectPermit("Puiden kaataminen: Äikkäänranta 15")).toBe(true)
    expect(isNonProjectPermit("Maisematyölupa: Puiden kaataminen.: Kivisalmentie 4")).toBe(true)
  })
})
