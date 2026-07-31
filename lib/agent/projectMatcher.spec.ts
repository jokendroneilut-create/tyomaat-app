import { describe, it, expect } from "vitest"
import { findProjectMatchDetailed } from "./projectMatcher"

const BLANK = {
  city: null,
  region: null,
  location: null,
  permitNumber: null,
  propertyId: null,
  developer: null,
  buildingType: null,
  estimatedCompletion: null,
  description: null,
}

const project = (id: string, name: string, extra: Record<string, any> = {}) => ({
  id,
  name,
  city: null,
  region: null,
  location: null,
  phase: "Suunnittelussa",
  status: "active",
  completed_at: null,
  developer: null,
  property_type: null,
  estimated_completion: null,
  additional_info: null,
  metadata: null,
  ...extra,
})

describe("findProjectMatchDetailed — erottuva otsikko", () => {
  /*
   * Kandidaatilla on usein vain otsikko (yritysten lehdistötiedotteet).
   * Ennen tätä sääntöä exact_title antoi 55 pistettä eikä kynnys 70 ylittynyt
   * koskaan pelkällä nimellä, joten jo tunnetusta hankkeesta kertova uutisi
   * päätyi uutena ehdokkaana jonoon.
   */
  it("täsmää pelkällä pitkällä identtisellä otsikolla", () => {
    const projects = [project("a", "FINNOONNIITYN LINJA-AUTOVARIKKO")]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "FINNOONNIITYN LINJA-AUTOVARIKKO",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.confidence).toBeGreaterThanOrEqual(70)
    expect(match?.reasons).toContain("exact_distinctive_title")
  })

  it("ei täsmää lyhyellä otsikolla ilman muuta todistetta", () => {
    const projects = [project("a", "Mastojen rakentaminen")]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Mastojen rakentaminen",
    } as any)

    // Osuma löytyy mutta jää kynnyksen alle, joten tuonti ei yhdistä niitä.
    expect(match?.confidence).toBeLessThan(70)
    expect(match?.reasons).toContain("exact_title")
  })

  /*
   * Aineistossa on eri hankkeita samalla nimellä. Silloin otsikko ei kerro
   * kummasta on kyse, ja umpimähkäinen päivitys olisi pahempi kuin ehdokkaan
   * jättäminen ihmisen arvioitavaksi.
   */
  it("ei täsmää kun sama otsikko on usealla hankkeella", () => {
    const projects = [
      project("a", "Rakentamista valmisteleva puiden kaato tontilta"),
      project("b", "Rakentamista valmisteleva puiden kaato tontilta"),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Rakentamista valmisteleva puiden kaato tontilta",
    } as any)

    expect(match).toBeNull()
  })

  it("täsmää monitulkintaisesta nimestä huolimatta kun on muutakin todistetta", () => {
    const projects = [
      project("a", "Rakentamista valmisteleva puiden kaato tontilta", {
        city: "Espoo",
      }),
      project("b", "Rakentamista valmisteleva puiden kaato tontilta"),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Rakentamista valmisteleva puiden kaato tontilta",
      city: "Espoo",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.reasons).toContain("same_city")
  })
})
