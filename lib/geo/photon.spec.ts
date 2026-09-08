import { describe, expect, it } from "vitest"

import { katuVastaa, photonTulos } from "./photon"

const vastaus = (properties: any, koordinaatit: number[] = [24.9752, 60.1782]) => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", properties, geometry: { coordinates: koordinaatit } }],
})

describe("photonTulos", () => {
  it("hyvaksyy talo-osuman osoitetarkkana", () => {
    const t = photonTulos(
      vastaus({ type: "house", countrycode: "FI", street: "Tihtaalinkatu", housenumber: "4" })
    )
    expect(t).toEqual({ lat: 60.1782, lon: 24.9752, tarkkuus: "osoite", nimi: "Tihtaalinkatu" })
  })

  it("hyvaksyy katuosuman osoitetarkkana", () => {
    expect(photonTulos(vastaus({ type: "street", countrycode: "FI", name: "Hopeasalmentie" }))?.tarkkuus).toBe(
      "osoite"
    )
  })

  it("merkitsee kaupunkiosuman kaupunkitasoksi", () => {
    expect(photonTulos(vastaus({ type: "city", countrycode: "FI", name: "Helsinki" }))?.tarkkuus).toBe(
      "kaupunki"
    )
  })

  /*
   * PHOTON ARVAA. "Kanalinsuu Rauma" (kaavan nimi, ei osoite) palautti
   * testissa "Kanalinpuisto" tyypilla "other" - eri kohde, samalta
   * kuulostava nimi. Ilman tata porttia se olisi kirjattu
   * osoitetarkaksi pisteeksi.
   */
  it("hylkaa tyypin jota ei tunneta", () => {
    expect(photonTulos(vastaus({ type: "other", countrycode: "FI", name: "Kanalinpuisto" }))).toBeNull()
    expect(photonTulos(vastaus({ type: "locality", countrycode: "FI", name: "Jokin" }))).toBeNull()
  })

  it("hylkaa ulkomaisen osuman", () => {
    expect(photonTulos(vastaus({ type: "house", countrycode: "SE", street: "Storgatan" }))).toBeNull()
  })

  it("sietaa tyhjan ja rikkinaisen vastauksen", () => {
    expect(photonTulos(null)).toBeNull()
    expect(photonTulos({})).toBeNull()
    expect(photonTulos({ features: [] })).toBeNull()
    expect(photonTulos(vastaus({ type: "house", countrycode: "FI" }, []))).toBeNull()
  })
})

/*
 * Tyyppitarkistus ei riita: Photon palauttaa tyypin "house" myos
 * naapurikadulta. Mitattu kuivaharjoituksessa 2/23 vaaraa katua.
 */
describe("katuVastaa", () => {
  it("hyvaksyy saman kadun", () => {
    expect(katuVastaa("Tihtaalinkatu 4, Helsinki", "Tihtaalinkatu")).toBe(true)
    expect(katuVastaa("Taipalsaarentie 476, 53950 Lappeenranta", "Taipalsaarentie")).toBe(true)
  })

  it("hylkaa eri kadun", () => {
    expect(katuVastaa("Luhtaniityntie 6, Kerava", "Sibeliuksentie")).toBe(false)
    expect(katuVastaa("Pohjantie 2, 65380 Vaasa", "Kiitokaari")).toBe(false)
  })

  /* Tiukka tarkoituksella: tyhja on parempi kuin arvaus. */
  it("hylkaa lahes samannimisen", () => {
    expect(katuVastaa("Taimistonpolku 3, Salo", "Taimistopolku")).toBe(false)
  })

  it("hylkaa liian lyhyen", () => {
    expect(katuVastaa("Tie 1", "Tie")).toBe(false)
    expect(katuVastaa("", "Rovakatu")).toBe(false)
  })
})
