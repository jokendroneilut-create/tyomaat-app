import { describe, it, expect } from "vitest"
import * as cheerio from "cheerio"
import { parseNccBuildTime, cityFromNccTitle, nccKuvaus } from "./fetchNccProjectsSource"

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

describe("nccKuvaus (D-419)", () => {
  it("ottaa pääsisällön ilman ohituslinkkiä, kehotetta, lomakkeita ja tietolaatikkoa", () => {
    const html =
      `<html><body><a href="#main">Siirry sisältöön</a><main>` +
      `<p>Lue tästä työmaan viimeisin viikkotiedote!</p>` +
      `<h2>Toijalan uuden alakoulun rakennustyöt alkoivat keväällä 2025</h2>` +
      `<p>Toijalan uusi alakoulu rakennetaan noin 300 oppilaalle. Rakennukseen tulee kolme kerrosta ja sen bruttoala on noin 4 000 m2.</p>` +
      `<p>Lue lisää: 7.3.2025: Uuden alakoulun rakentaminen alkoi</p>` +
      `<h2>NCC koulurakentajana</h2><p>Menestyksekäs koulurakennushanke vaatii huolellista suunnittelua.</p>` +
      `<h2>Työmaan tiedotteiden tilaus</h2><p>Map data ©2026 Google</p>` +
      `<h3>Tiedot</h3><p>Rakennusaika: 03/2025 – 10/2026</p></main></body></html>`
    const k = nccKuvaus(cheerio.load(html))
    expect(k).toMatch(/^Toijalan uuden alakoulun rakennustyöt alkoivat/)
    expect(k).toMatch(/noin 4 000 m2\.$/)
    expect(k).not.toMatch(/Siirry|viikkotiedote|koulurakentajana|Map data|Rakennusaika/)
  })

  it("palauttaa nullin kun pääsisältöä ei ole", () => {
    expect(nccKuvaus(cheerio.load("<html><body><main><p>Lyhyt</p></main></body></html>"))).toBeNull()
  })
})
