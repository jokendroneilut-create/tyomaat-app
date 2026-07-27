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

  it("näyttää YVA-lähteen kun 'Ympäristö & YVA' on valittu", () => {
    expect(
      matchesSources({ metadata: { source_name: "yva" } }, ["ympäristö & yva"])
    ).toBe(true)
    expect(
      matchesSources({ metadata: { source_name: "yva" } }, ["hilma"])
    ).toBe(false)
  })

  it("näyttää ymparistolupa-lähteen 'Ympäristö & YVA':n alla eikä leimaa sitä rakennusluvaksi", () => {
    const ymparistolupa = {
      metadata: { source_name: "ymparistolupa", permit_number: "YM-123" },
    }
    expect(matchesSources(ymparistolupa, ["ympäristö & yva"])).toBe(true)
    // Vaikka sillä on permit_number, se ei saa osua "Rakennusluvat"-kategoriaan.
    expect(matchesSources(ymparistolupa, ["rakennusluvat"])).toBe(false)
  })

  it("näyttää suunnittelukilpailu-lähteen kun 'Suunnittelukilpailut' on valittu", () => {
    expect(
      matchesSources({ metadata: { source_name: "suunnittelukilpailu" } }, [
        "suunnittelukilpailut",
      ])
    ).toBe(true)
    expect(
      matchesSources({ metadata: { source_name: "suunnittelukilpailu" } }, [
        "hilma",
      ])
    ).toBe(false)
  })

  it("näyttää rakennuslehti-lähteen 'Yritysuutiset'-kategorian alla", () => {
    expect(
      matchesSources({ metadata: { source_name: "rakennuslehti" } }, [
        "yritysuutiset",
      ])
    ).toBe(true)
    expect(
      matchesSources({ metadata: { source_name: "rakennuslehti" } }, ["hilma"])
    ).toBe(false)
  })

  it("näyttää stt_haku-lähteen 'Yritysuutiset'-kategorian alla", () => {
    expect(
      matchesSources({ metadata: { source_name: "stt_haku" } }, [
        "yritysuutiset",
      ])
    ).toBe(true)
  })

  it("FAIL-OPEN: näyttää tuntemattoman lähteen kun kategoriaa ei ole eksplisiittisesti poistettu", () => {
    // Osittainen valinta jättää tuntemattoman lähteen pois vanhassa logiikassa;
    // fail-open pitää sen näkyvissä koska sillä ei ole kategoriaa joka voitaisiin sulkea.
    expect(
      matchesSources({ metadata: { source_name: "aivan_uusi_lahde" } }, [
        "hilma",
      ])
    ).toBe(true)
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
