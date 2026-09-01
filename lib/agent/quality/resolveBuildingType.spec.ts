import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { resolveBuildingType } from "./resolveBuildingType"

const SCORER = "./scorers/llmBuildingTypeScorer"

const kutsut: any[] = []
/* Vastausjono: kun tyhja, palautetaan vakiovastaus. */
const vastaukset: any[] = []

vi.mock("./scorers/llmBuildingTypeScorer", async (alkuperainen) => {
  const oikea = (await alkuperainen()) as any
  return {
    ...oikea,
    scoreBuildingType: async (syote: any) => {
      kutsut.push(syote)
      return vastaukset.length
        ? vastaukset.shift()
        : { type: "Koulu", confidence: 0.95, model: "testi" }
    },
  }
})

describe("resolveBuildingType", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "testi"
    kutsut.length = 0
    vastaukset.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  /* Saanto voittaa: se on ilmainen ja mitattu lahes virheettomaksi. */
  it("ei kysy mallilta kun saanto osasi", async () => {
    const moduuli = await import(SCORER)
    const vakoilija = vi.spyOn(moduuli, "scoreBuildingType")
    const tulos = await resolveBuildingType({
      title: "Päiväkoti Myllytupa",
      ruleBuildingType: "Päiväkoti",
    })
    expect(tulos.metadata).toEqual({})
    expect(vakoilija).not.toHaveBeenCalled()
  })

  /*
   * Sanaston ulkopuolinen arvo ei osu asiakkaan suodattimeen, joten se
   * on kaytannossa tyhja ja malli saa sanoa sanansa.
   */
  it("kysyy mallilta kun saannon arvo on sanaston ulkopuolella", async () => {
    const tulos = await resolveBuildingType({
      title: "Koulukeskuksen peruskorjaus",
      ruleBuildingType: "Julkinen rakennus",
    })
    expect(kutsut).toHaveLength(2)
    expect(tulos.metadata.building_type).toBe("Koulu")
    expect(tulos.metadata.building_type_source).toBe("llm")
  })

  /*
   * Erimielisyys on mitattu virheen merkki: 9/60 rivilla vastaukset
   * erosivat, ja kaikki loydetyt virheet olivat siina joukossa.
   */
  it("jattaa tyhjaksi kun kutsut ovat eri mielta", async () => {
    vastaukset.push(
      { type: "Toimitila", confidence: 0.95, model: "testi" },
      { type: "Kauppa", confidence: 0.95, model: "testi" }
    )
    const tulos = await resolveBuildingType({ title: "Jokin myymalahanke", ruleBuildingType: null })
    expect(kutsut).toHaveLength(2)
    expect(tulos.metadata).toEqual({})
  })

  it("jattaa tyhjaksi kun varmuus on matala", async () => {
    vastaukset.push(
      { type: "Leikkipuisto", confidence: 0.35, model: "testi" },
      { type: "Leikkipuisto", confidence: 0.35, model: "testi" }
    )
    const tulos = await resolveBuildingType({
      title: "Kayrapolun puistikon portaiden puistosuunnitelma",
      ruleBuildingType: null,
    })
    expect(tulos.metadata).toEqual({})
  })

  it("ei kysy ilman otsikkoa", async () => {
    expect((await resolveBuildingType({ title: null, ruleBuildingType: null })).metadata).toEqual({})
  })

  /* Ilman avainta kentta jaa tyhjaksi kuten ennenkin. */
  it("on hiljaa ilman API-avainta", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const tulos = await resolveBuildingType({ title: "Jokin hanke", ruleBuildingType: null })
    expect(tulos.metadata).toEqual({})
  })
})
