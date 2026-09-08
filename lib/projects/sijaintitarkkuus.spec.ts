import { describe, expect, it } from "vitest"

import {
  karkeatPisteet,
  onKarkeaSijainti,
  pisteAvain,
  sijainninTarkkuusTeksti,
} from "./sijaintitarkkuus"

const piste = (lat: number, lng: number, metadata?: any) => ({
  latitude: lat,
  longitude: lng,
  metadata,
})

describe("pisteAvain", () => {
  it("lukee molemmat sarakeparit", () => {
    expect(pisteAvain({ latitude: 60.16662, longitude: 24.94354 })).toBe("60.16662,24.94354")
    expect(pisteAvain({ lat: "60.16662", lng: "24.94354" })).toBe("60.16662,24.94354")
  })

  it("palauttaa nullin ilman koordinaatteja", () => {
    expect(pisteAvain({})).toBeNull()
    expect(pisteAvain({ latitude: 60, longitude: null })).toBeNull()
  })
})

/*
 * KYNNYS ON KOLME. Kahden hankkeen kasat ovat mitattuna sekalaisia:
 * "Ilmarinkatu 17, Tampere" esiintyy kahdesti samana kouluna eli
 * aidosti tarkkana. Kolmesta ylospain poikkeusta ei loytynyt.
 */
describe("karkeatPisteet", () => {
  it("merkitsee kolmen hankkeen kasan karkeaksi", () => {
    const karkeat = karkeatPisteet([
      piste(60.16662, 24.94354),
      piste(60.16662, 24.94354),
      piste(60.16662, 24.94354),
      piste(61.4978, 23.76163),
    ])
    expect(karkeat.has("60.16662,24.94354")).toBe(true)
    expect(karkeat.has("61.49780,23.76163")).toBe(false)
  })

  it("jattaa kahden hankkeen parin rauhaan", () => {
    const karkeat = karkeatPisteet([piste(61.5014, 23.78533), piste(61.5014, 23.78533)])
    expect(karkeat.size).toBe(0)
  })

  it("sietaa koordinaatittomat", () => {
    expect(karkeatPisteet([{}, { latitude: null, longitude: null }]).size).toBe(0)
  })
})

describe("onKarkeaSijainti", () => {
  const karkeat = new Set(["60.16662,24.94354"])

  it("tunnistaa kasauman karkeaksi", () => {
    expect(onKarkeaSijainti(piste(60.16662, 24.94354), karkeat)).toBe(true)
    expect(onKarkeaSijainti(piste(60.507, 22.379), karkeat)).toBe(false)
  })

  /* Tallennettu tarkkuus voittaa paattelyn: geokoodari tietaa, kasauma arvaa. */
  it("luottaa tallennettuun tarkkuuteen", () => {
    expect(
      onKarkeaSijainti(piste(60.16662, 24.94354, { geocode_source: "osoite" }), karkeat)
    ).toBe(false)
    expect(onKarkeaSijainti(piste(60.507, 22.379, { geocode_source: "kaupunki" }), karkeat)).toBe(
      true
    )
    expect(onKarkeaSijainti(piste(60.507, 22.379, { geocode_source: "maakunta" }), karkeat)).toBe(
      true
    )
  })
})

describe("sijainninTarkkuusTeksti", () => {
  it("erottaa maakunnan kaupungista", () => {
    expect(sijainninTarkkuusTeksti(piste(60, 24, { geocode_source: "maakunta" }))).toContain(
      "maakunnan"
    )
    expect(sijainninTarkkuusTeksti(piste(60, 24))).toContain("kaupungin")
  })
})
