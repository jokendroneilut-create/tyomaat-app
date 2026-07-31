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

describe("findProjectMatchDetailed — sijainnin tarkkuus", () => {
  /*
   * Käsin täydennetty oikea tieto ei saa huonontaa tulosta. Kun osoitteeksi
   * merkitään pelkkä kunnan nimi, se ei ole todiste samasta kohteesta -
   * muuten kaksi saman kaupungin eri hanketta yhdistyisivät.
   */
  it("ei yhdistä eri hankkeita pelkän kaupunginnimen perusteella", () => {
    const projects = [
      project("a", "Kaksi asuinkerrostaloa Pukimon kortteliin Kouvolassa", {
        city: "Kouvola",
        region: "Kymenlaakso",
        location: "Kouvola",
      }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      region: "Kymenlaakso",
      location: "Kouvola",
    } as any)

    expect(match?.reasons ?? []).not.toContain("same_location")
    expect(match?.confidence ?? 0).toBeLessThan(70)
  })

  /*
   * Käsin täydennetyn tiedon pitää auttaa: sama rakennuttaja samassa
   * kaupungissa nostaa hankkeen esiin mahdollisena duplikaattina, vaikka
   * uutisotsikko ei muistuta hankkeen nimeä.
   */
  it("tunnistaa mahdollisen duplikaatin rakennuttajasta ja kaupungista", () => {
    const projects = [
      project("a", "FIN04A Datakeskus", {
        city: "Kouvola",
        region: "Kymenlaakso",
        developer: "Atnorth",
      }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      region: "Kymenlaakso",
      developer: "AtNorth",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.reasons).toContain("same_developer")
    // Riittää mahdolliseksi duplikaatiksi (>= 40) muttei yhdistämiseen (>= 70)
    expect(match!.confidence).toBeGreaterThanOrEqual(40)
    expect(match!.confidence).toBeLessThan(70)
  })

  it("ei nosta pelkän rakennuttajan perusteella eri kaupungissa", () => {
    const projects = [
      project("a", "Aivan muu hanke", { city: "Oulu", developer: "Atnorth" }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      developer: "AtNorth",
    } as any)

    expect(match).toBeNull()
  })

  it("yhdistää edelleen kun osoite on katutarkkuudella sama", () => {
    const projects = [
      project("a", "Kohde A", { city: "Kouvola", location: "Kauppakatu 12, Kouvola" }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Kohde B",
      city: "Kouvola",
      location: "Kauppakatu 12, Kouvola",
    } as any)

    expect(match?.reasons).toContain("same_location")
  })
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
