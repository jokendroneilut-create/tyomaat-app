import { describe, it, expect } from "vitest"
import {
  matchesBestSalesMoments,
  matchesSources,
  matchesRegions,
} from "./todayFilters"

describe("matchesBestSalesMoments", () => {
  it("tunnistaa kilpailutuksen vaiheesta ja lähteestä", () => {
    expect(
      matchesBestSalesMoments({ phase: "Kilpailutus" }, ["kilpailutus"])
    ).toBe(true)
    expect(
      matchesBestSalesMoments(
        { metadata: { source_name: "Hilma" } },
        ["kilpailutus"]
      )
    ).toBe(true)
  })

  it("ei osu, kun hanke on eri vaiheessa", () => {
    expect(
      matchesBestSalesMoments({ phase: "Rakenteilla" }, ["kilpailutus"])
    ).toBe(false)
  })

  it("päästää läpi kun mitään ei ole valittu tai valittu 'kaikki vaiheet'", () => {
    expect(matchesBestSalesMoments({ phase: "Kilpailutus" }, [])).toBe(true)
    expect(
      matchesBestSalesMoments({ phase: "Rakenteilla" }, ["kaikki vaiheet"])
    ).toBe(true)
  })
})

describe("matchesSources", () => {
  it("osuu Hilma-lähteeseen", () => {
    expect(
      matchesSources({ metadata: { source_name: "Hilma" } }, ["hilma"])
    ).toBe(true)
  })

  it("ei osu, kun lähde on eri", () => {
    expect(
      matchesSources({ metadata: { source_name: "Espoon kuulutukset" } }, [
        "hilma",
      ])
    ).toBe(false)
  })

  it("päästää läpi tyhjällä valinnalla", () => {
    expect(matchesSources({ metadata: { source_name: "Hilma" } }, [])).toBe(true)
  })
})

describe("matchesRegions", () => {
  it("osuu valittuun maakuntaan", () => {
    expect(matchesRegions({ region: "Uusimaa" }, ["uusimaa"])).toBe(true)
  })

  it("ei osu eri maakuntaan eikä puuttuvaan alueeseen", () => {
    expect(matchesRegions({ region: "Pirkanmaa" }, ["uusimaa"])).toBe(false)
    expect(matchesRegions({}, ["uusimaa"])).toBe(false)
  })

  it("päästää läpi 'koko suomi' -valinnalla ja tyhjällä", () => {
    expect(matchesRegions({ region: "Pirkanmaa" }, ["koko suomi"])).toBe(true)
    expect(matchesRegions({ region: "Pirkanmaa" }, [])).toBe(true)
  })
})
