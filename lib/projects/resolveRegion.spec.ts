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

/*
 * Hilman ilmoituksessa kuntaa ei aina ole omana kenttanaan, mutta
 * tilaaja on kunta itse. Loytyi 1.9.2026: "Merrankujan katu- ja
 * vesihuoltosaneeraus", kunta null, tilaaja "Iitin kunta".
 */
describe("resolveRegion tilaajan nimesta", () => {
  it("paattelee maakunnan kunnan nimesta tilaajana", () => {
    expect(resolveRegion({ buyerName: "Iitin kunta" })).toBe("Päijät-Häme")
    expect(resolveRegion({ buyerName: "Espoon kaupunki" })).toBe("Uusimaa")
  })

  it("ei paattele yksityisesta tilaajasta", () => {
    expect(resolveRegion({ buyerName: "YIT Oyj" })).toBeNull()
    expect(resolveRegion({ buyerName: "Kiinteistö Oy Merrankuja" })).toBeNull()
  })

  it("kunta voittaa tilaajan", () => {
    expect(resolveRegion({ city: "Espoo", buyerName: "Iitin kunta" })).toBe("Uusimaa")
  })

  /*
   * Maakunnallinen tilaaja ja otsikko. Mitattu rivi 2.9.2026: Hilman
   * ilmoitus "Kiteen alueen tyokone- ja kuljetuspalvelut", tilaajana
   * Pohjois-Karjalan hankintatoimi, ilman kuntakenttaa.
   */
  it("lukee maakunnan maakunnallisen tilaajan nimesta", () => {
    expect(
      resolveRegion({ metadataRegion: null, city: null, buyerName: "Pohjois-Karjalan hankintatoimi" })
    ).toBe("Pohjois-Karjala")
  })

  it("lukee maakunnan otsikon genetiivista viimeisena keinona", () => {
    expect(
      resolveRegion({
        metadataRegion: null,
        city: null,
        buyerName: null,
        title: "Kiteen alueen työkone- ja kuljetuspalvelut",
      })
    ).toBe("Pohjois-Karjala")
  })

  it("ei arvaa maakuntaa yritystilaajasta eika tavallisesta otsikosta", () => {
    expect(
      resolveRegion({ metadataRegion: null, city: null, buyerName: "Senaatti-kiinteistöt", title: "Hankesuunnittelupalvelut" })
    ).toBeNull()
  })
})
