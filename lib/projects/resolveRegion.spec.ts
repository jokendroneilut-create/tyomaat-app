import { describe, expect, it } from "vitest"

import { resolveRegion } from "./resolveRegion"

describe("resolveRegion", () => {
  /* Tama oli vika: Espoon kuulutuksissa ei ole maakuntaa metadatassa. */
  it("paattelee maakunnan kunnasta", () => {
    expect(resolveRegion({ city: "Espoo" })).toBe("Uusimaa")
    expect(resolveRegion({ city: "Pietarsaari" })).toBe("Pohjanmaa")
  })

  it("kayttaa lahteen omaa maakuntaa jos se on", () => {
    expect(resolveRegion({ metadataRegion: "Pirkanmaa", city: "Espoo" })).toBe("Pirkanmaa")
  })

  it("sietaa valilyonnit ja kirjainkoon", () => {
    expect(resolveRegion({ city: "  espoo " })).toBe("Uusimaa")
    expect(resolveRegion({ metadataRegion: "   ", city: "Espoo" })).toBe("Uusimaa")
  })

  /* Tuntemattomasta kunnasta ei arvata: mieluummin tyhja kuin vaara. */
  it("palauttaa nullin kun kuntaa ei tunneta", () => {
    expect(resolveRegion({ city: "Ei tällaista kuntaa" })).toBeNull()
    expect(resolveRegion({})).toBeNull()
    expect(resolveRegion({ city: null, metadataRegion: null })).toBeNull()
  })
})
