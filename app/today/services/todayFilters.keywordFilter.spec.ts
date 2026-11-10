import { describe, expect, it } from "vitest"
import { matchedKeywords, matchesKeywordFilter } from "./todayFilters"

const hanke = (yli: Record<string, any> = {}) => ({
  name: "Jokinotkon koulun peruskorjaus",
  property_type: "Koulu",
  additional_info: "Koulurakennuksen peruskorjaus ja laajennus.",
  metadata: {},
  ...yli,
})

describe("avainsanaosuma", () => {
  it("lukee myös property_type-sarakkeen", () => {
    /*
     * Juuri tämä puuttui: hankkeen tyyppi on Datakeskus, mutta sanaa ei ole
     * nimessä eikä kuvauksessa. Ennen korjausta osuma jäi syntymättä.
     */
    const datakeskus = hanke({
      name: "Metsovuoren asemakaava",
      property_type: "Datakeskus",
      additional_info: "Asemakaavan muutos Metsovuoren alueella.",
    })

    expect(matchedKeywords(datakeskus, ["datakeskus"])).toEqual(["datakeskus"])
  })

  it("lyhyt sana vaatii sananrajan, pitkä ei", () => {
    const lvi = hanke({ additional_info: "LVI-urakka ja ilmanvaihto." })

    expect(matchedKeywords(lvi, ["lvi"])).toEqual(["lvi"])
    expect(matchedKeywords(hanke({ additional_info: "Palvelvi" }), ["lvi"])).toEqual([])
    expect(matchedKeywords(hanke({ additional_info: "Sähköistys" }), ["sähkö"])).toEqual(["sähkö"])
  })
})

describe("matchesKeywordFilter", () => {
  it("päästää kaiken läpi kun rastia ei ole", () => {
    expect(matchesKeywordFilter(hanke(), ["datakeskus"], false)).toBe(true)
  })

  it("päästää kaiken läpi kun avainsanoja ei ole", () => {
    expect(matchesKeywordFilter(hanke(), [], true)).toBe(true)
  })

  it("pudottaa osumattoman kun rasti on päällä", () => {
    expect(matchesKeywordFilter(hanke(), ["datakeskus"], true)).toBe(false)
  })

  it("päästää osuvan läpi", () => {
    const dk = hanke({ property_type: "Datakeskus" })
    expect(matchesKeywordFilter(dk, ["datakeskus"], true)).toBe(true)
  })

  it("EI pudota hanketta josta ei tiedetä tyyppiä eikä kuvausta", () => {
    /*
     * Jos emme tiedä, näytämme: osumattomuus ei todista mitään kun rivillä
     * on vain nimi. Suodatin poistaa vain tiedetyn.
     */
    const tuntematon = {
      name: "Kohde 14",
      property_type: null,
      additional_info: null,
      metadata: {},
    }

    expect(matchesKeywordFilter(tuntematon, ["datakeskus"], true)).toBe(true)
  })

  it("pudottaa rivin jolla on kuvaus muttei tyyppiä", () => {
    const vainKuvaus = {
      name: "Kohde 15",
      property_type: null,
      additional_info: "Päiväkodin laajennus.",
      metadata: {},
    }

    expect(matchesKeywordFilter(vainKuvaus, ["datakeskus"], true)).toBe(false)
  })
})
