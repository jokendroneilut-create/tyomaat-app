import { describe, it, expect } from "vitest"
import {
  collectProjectCompanies,
  mergeCompanyNames,
  awardWinnersFromMetadata,
} from "./projectCompanies"

describe("mergeCompanyNames", () => {
  it("yhdistää listat ilman duplikaatteja", () => {
    expect(mergeCompanyNames(["A Oy"], ["B Oy", "A Oy"])).toEqual(["A Oy", "B Oy"])
  })

  it("valitsee täydellisimmän kirjoitusasun", () => {
    expect(mergeCompanyNames(["Lujatalo Oy"], ["Lujatalo Oy (1234567-8)"])).toEqual([
      "Lujatalo Oy (1234567-8)",
    ])
  })

  it("pilkkoo monta yritystä sisältävät arvot", () => {
    expect(mergeCompanyNames(["A Oy (1111111-1), B Oy (2222222-2)"])).toEqual([
      "A Oy (1111111-1)",
      "B Oy (2222222-2)",
    ])
  })

  it("sietää tyhjät ja puuttuvat listat", () => {
    expect(mergeCompanyNames(null, undefined, ["", "  ", "-"])).toEqual([])
  })
})

describe("awardWinnersFromMetadata", () => {
  it("kokoaa voittajat kaikista voittajailmoituksista", () => {
    expect(
      awardWinnersFromMetadata({
        source_history: [
          { is_contract_award: true, winners: ["A Oy"] },
          { is_contract_award: false, winners: ["Ei tama Oy"] },
          { is_contract_award: true, winners: ["B Oy"] },
        ],
        winners: ["A Oy", "C Oy"],
      })
    ).toEqual(["A Oy", "B Oy", "C Oy"])
  })

  it("palauttaa tyhjän kun voittajia ei ole", () => {
    expect(awardWinnersFromMetadata({})).toEqual([])
    expect(awardWinnersFromMetadata(null)).toEqual([])
  })
})

describe("collectProjectCompanies", () => {
  it("jättää tyhjät roolit pois", () => {
    const companies = collectProjectCompanies({
      developer: "Vihdin kunta",
      builder: null,
      structural_design: null,
      hvac_design: "  ",
      electrical_design: "-",
    })

    expect(companies).toEqual([{ role: "Rakennuttaja", name: "Vihdin kunta" }])
  })

  it("palauttaa tyhjän listan kun mitään ei tiedetä", () => {
    expect(collectProjectCompanies({})).toEqual([])
    expect(collectProjectCompanies(null)).toEqual([])
  })

  /*
   * Ydintapaus: usean osaurakan hankinta. Mitattu tuotannosta - Kaukametsän
   * kansalaisopisto (Kajaani) sai neljä voittajailmoitusta, joista vain
   * yksi näkyi kortilla.
   */
  it("kokoaa kaikki voittajat erillisistä ilmoituksista", () => {
    const companies = collectProjectCompanies({
      builder: "NK Tekniikka Oy (2952184-6)",
      metadata: {
        source_history: [
          { is_contract_award: true, winners: ["Sakela Service Oy (3455387-7)"] },
          { is_contract_award: true, winners: ["Optimation Finland Oy (2708916-4)"] },
          { is_contract_award: true, winners: ["InPro Rakennus Oy (FI27357157)"] },
          { is_contract_award: true, winners: ["NK Tekniikka Oy (2952184-6)"] },
        ],
      },
    })

    expect(companies).toHaveLength(4)
    expect(companies.map((c) => c.name)).toContain("Sakela Service Oy (3455387-7)")
    expect(companies.map((c) => c.name)).toContain("InPro Rakennus Oy (FI27357157)")
  })

  it("ei laske samaa yritystä kahdesti vaikka se on sekä builder että voittaja", () => {
    const companies = collectProjectCompanies({
      builder: "Agomar Oy (2148617-7)",
      metadata: {
        source_history: [
          { is_contract_award: true, winners: ["Agomar Oy (2148617-7)"] },
        ],
      },
    })

    expect(companies).toEqual([
      { role: "Pääurakoitsija", name: "Agomar Oy (2148617-7)" },
    ])
  })

  /*
   * Sama yritys ilman y-tunnusta ja sen kanssa on sama yritys. Näytetään
   * täydellisempi muoto, mutta rooli säilyy ensimmäisenä löytyneenä.
   */
  it("yhdistää saman yrityksen eri kirjoitusasut ja säilyttää y-tunnuksen", () => {
    const companies = collectProjectCompanies({
      builder: "Kuljetuspolar Oy",
      metadata: {
        winners: ["Kuljetuspolar Oy (0195020-0)"],
      },
    })

    expect(companies).toEqual([
      { role: "Pääurakoitsija", name: "Kuljetuspolar Oy (0195020-0)" },
    ])
  })

  it("ohittaa ilmoitukset jotka eivät ole voittajailmoituksia", () => {
    const companies = collectProjectCompanies({
      metadata: {
        source_history: [
          { is_contract_award: false, winners: ["Ei tämä Oy"] },
          { is_contract_award: true, winners: ["Voittaja Oy"] },
        ],
      },
    })

    expect(companies).toEqual([{ role: "Urakoitsija", name: "Voittaja Oy" }])
  })

  it("ottaa mukaan käsin lisätyt liittyvät yritykset", () => {
    const companies = collectProjectCompanies({
      builder: "Lujatalo Oy",
      metadata: { related_companies: ["Bravida Finland Oy"] },
    })

    expect(companies).toEqual([
      { role: "Pääurakoitsija", name: "Lujatalo Oy" },
      { role: "Liittyvä yritys", name: "Bravida Finland Oy" },
    ])
  })

  /*
   * Yksi kenttä voi sisältää monta yritystä: Hilman "//" tai hyväksynnän
   * tallentama pilkkulista. Ilman pilkkomista yhdistelmä näkyi omana
   * rivinään JA yritykset erikseen — mitattu Peltolammin
   * hyvinvointikeskuksessa, jossa kortti näytti 6 riviä 4 yrityksestä.
   */
  it("pilkkoo monta yritystä sisältävän kentän", () => {
    const combined =
      "Skanska Talonrakennus Oy (1772433-9), Putkiliike P. Nuora Oy (0300178-9), " +
      "ESP Tekniikka Oy (2378923-5), Novasähkö Oy (0926323-7)"

    const companies = collectProjectCompanies({
      builder: combined,
      metadata: {
        source_history: [
          {
            is_contract_award: true,
            winners: [
              "Skanska Talonrakennus Oy (1772433-9)",
              "Putkiliike P. Nuora Oy (0300178-9)",
              "ESP Tekniikka Oy (2378923-5)",
              "Novasähkö Oy (0926323-7)",
            ],
          },
        ],
      },
    })

    expect(companies).toHaveLength(4)
    // Emme voi tietää kuka neljästä on pääurakoitsija, joten ei väitetä.
    expect(companies.every((c) => c.role === "Urakoitsija")).toBe(true)
  })

  it("säilyttää pääurakoitsija-roolin kun kentässä on yksi yritys", () => {
    const companies = collectProjectCompanies({ builder: "Lujatalo Oy (1234567-8)" })

    expect(companies).toEqual([
      { role: "Pääurakoitsija", name: "Lujatalo Oy (1234567-8)" },
    ])
  })

  it("pilkkoo myös Hilman // -erottimen", () => {
    const companies = collectProjectCompanies({
      builder: "Artkivi Oy (2262321-7)//Maklin Oy (2917209-2)",
    })

    expect(companies.map((c) => c.name)).toEqual([
      "Artkivi Oy (2262321-7)",
      "Maklin Oy (2917209-2)",
    ])
  })

  it("ei pilko yrityksen nimessä olevaa pilkkua", () => {
    const companies = collectProjectCompanies({
      developer: "Kiinteistö Oy Turku, Linnankatu",
    })

    expect(companies).toEqual([
      { role: "Rakennuttaja", name: "Kiinteistö Oy Turku, Linnankatu" },
    ])
  })

  it("säilyttää suunnittelijaroolit", () => {
    const companies = collectProjectCompanies({
      structural_design: "Rakennesuunnittelu Oy",
      architectural_design: "Arkkitehdit Oy",
      earthworks_contractor: "Maansiirto Oy",
    })

    expect(companies.map((c) => c.role)).toEqual([
      "Rakennesuunnittelu",
      "Arkkitehtisuunnittelu",
      "Maanrakentaja",
    ])
  })
})
