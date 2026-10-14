import { describe, expect, it } from "vitest"

import { alueetSuodattimeen, hankelistanOsoite, onKokoSuomi } from "./alueasetus"

describe("onKokoSuomi", () => {
  it("tunnistaa koko maan", () => {
    expect(onKokoSuomi("Koko Suomi")).toBe(true)
    expect(onKokoSuomi("koko suomi")).toBe(true)
    expect(onKokoSuomi(" Koko Suomi ")).toBe(true)
  })

  it("ei sekoita maakuntaan", () => {
    expect(onKokoSuomi("Uusimaa")).toBe(false)
    expect(onKokoSuomi("Varsinais-Suomi")).toBe(false)
    expect(onKokoSuomi("Pohjois-Suomi")).toBe(false)
    expect(onKokoSuomi(null)).toBe(false)
  })
})

describe("hankelistanOsoite", () => {
  it("rajaa maakuntaan kun sellainen on valittu", () => {
    expect(hankelistanOsoite(["Uusimaa"])).toBe("/projects?region=Uusimaa")
  })

  it("koodaa ääkköset ja viivat", () => {
    expect(hankelistanOsoite(["Etelä-Karjala"])).toBe(
      "/projects?region=Etel%C3%A4-Karjala"
    )
  })

  it("EI rajaa kun alueena on koko maa", () => {
    /*
     * Tämä oli vika: "Koko Suomi" meni maakuntasuodattimeen ja tulos
     * oli nolla hanketta, koska mikään hanke ei ole siinä maakunnassa.
     */
    expect(hankelistanOsoite(["Koko Suomi"])).toBe("/projects")
  })

  it("ei rajaa kun alueita ei ole", () => {
    expect(hankelistanOsoite([])).toBe("/projects")
    expect(hankelistanOsoite(null)).toBe("/projects")
    expect(hankelistanOsoite([""])).toBe("/projects")
  })

  it("ottaa ensimmäisen aidon alueen", () => {
    expect(hankelistanOsoite(["", "Pirkanmaa", "Satakunta"])).toBe(
      "/projects?region=Pirkanmaa"
    )
  })
})

describe("alueetSuodattimeen", () => {
  it("karsii koko maan pois rajauksesta", () => {
    expect(alueetSuodattimeen(["Koko Suomi"])).toEqual([])
  })

  it("sailyttaa aidot maakunnat", () => {
    expect(alueetSuodattimeen(["Uusimaa", "Pirkanmaa"])).toEqual(["Uusimaa", "Pirkanmaa"])
  })

  it("karsii koko maan muiden joukosta", () => {
    expect(alueetSuodattimeen(["Koko Suomi", "Uusimaa"])).toEqual(["Uusimaa"])
  })

  it("lukee myos yksittaisen merkkijonon (vanhat tallennetut haut)", () => {
    expect(alueetSuodattimeen("Uusimaa")).toEqual(["Uusimaa"])
    expect(alueetSuodattimeen("Koko Suomi")).toEqual([])
  })

  it("kestaa tyhjan ja roskan", () => {
    expect(alueetSuodattimeen(null)).toEqual([])
    expect(alueetSuodattimeen([])).toEqual([])
    expect(alueetSuodattimeen(["", "  "])).toEqual([])
    expect(alueetSuodattimeen([1, "Uusimaa"])).toEqual(["Uusimaa"])
  })
})
