import { describe, it, expect } from "vitest"
import { parseNccBuildTime, cityFromNccTitle } from "./fetchNccProjectsSource"

describe("parseNccBuildTime", () => {
  it("lukee alun ja lopun kuukausitarkkuudella", () => {
    expect(parseNccBuildTime("5/2026 - 9/2028")).toEqual({
      startsAt: "2026-05-01",
      endsAt: "2028-09-01",
    })
  })

  /* "syksy 2030" ei anna kuukautta; vuosi riittää. */
  it("kelpuuttaa sanallisen loppuajan", () => {
    expect(parseNccBuildTime("10/2025 – syksy 2030")).toEqual({
      startsAt: "2025-10-01",
      endsAt: "2030-12-31",
    })
  })
})

describe("cityFromNccTitle", () => {
  /*
   * NCC nimeää sivut järjestelmällisesti "<hanke>, <kaupunki>", joten
   * kaupunki on luotettavampi otsikosta kuin leipätekstistä arvattuna.
   */
  it("lukee kaupungin viimeisen pilkun jälkeen", () => {
    expect(cityFromNccTitle("Kansallisarkiston peruskorjaus, Helsinki")).toBe("Helsinki")
    expect(cityFromNccTitle("S:t Olofsskolan, Turku")).toBe("Turku")
  })

  it("palauttaa nullin kun kaupunkia ei ole", () => {
    expect(cityFromNccTitle("Korjausrakentamisen puitesopimus")).toBeNull()
  })
})
