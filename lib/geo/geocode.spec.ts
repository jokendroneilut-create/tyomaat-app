import { describe, expect, it } from "vitest"

import { geocodeProjectLocation, onSijaintitietoa } from "./geocode"

/*
 * PELKKA "Finland" EI OLE SIJAINTI.
 *
 * Kysely oli [location, city, region, "Finland"], joten ilman kolmea
 * ensimmaista jaljelle jai pelkka "Finland" ja Nominatim vastasi maan
 * solmupisteella 63.247, 25.921. Mitattu 8.9.2026: kolme hanketta sai
 * nain koordinaatit Haapajarven kohdalta.
 */
describe("onSijaintitietoa", () => {
  it("hyvaksyy minka tahansa oikean sijaintitiedon", () => {
    expect(onSijaintitietoa({ location: "Koulukuja 1, Lieto" })).toBe(true)
    expect(onSijaintitietoa({ city: "Tampere" })).toBe(true)
    expect(onSijaintitietoa({ region: "Uusimaa" })).toBe(true)
  })

  it("hylkaa tyhjan", () => {
    expect(onSijaintitietoa({})).toBe(false)
    expect(onSijaintitietoa({ location: null, city: null, region: null })).toBe(false)
    expect(onSijaintitietoa({ location: "   ", city: "", region: "  " })).toBe(false)
  })
})

describe("geocodeProjectLocation", () => {
  /*
   * Ei verkkokutsua lainkaan kun sijaintia ei ole: testi menisi lapi
   * myos ilman tata, mutta silloin se kutsuisi Nominatimia.
   */
  it("palauttaa tyhjan eika hae mitaan ilman sijaintitietoa", async () => {
    const tulos = await geocodeProjectLocation({ location: null, city: null, region: null })
    expect(tulos).toEqual({ lat: null, lon: null, tarkkuus: null })
  })
})
