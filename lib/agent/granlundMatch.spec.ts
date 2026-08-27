import { describe, expect, it } from "vitest"

import { competingTitles, normalizeTitle, titleSimilarity } from "./granlundMatch"

describe("normalizeTitle", () => {
  it("poistaa tarkkeet ja valimerkit", () => {
    expect(normalizeTitle("Finlandia-talo")).toBe("finlandia talo")
    expect(normalizeTitle("Tainionkosken kirkko, Imatra")).toBe("tainionkosken kirkko imatra")
    expect(normalizeTitle("Hyvinkää")).toBe("hyvinkaa")
  })

  it("kestaa tyhjan", () => {
    expect(normalizeTitle(null)).toBe("")
    expect(normalizeTitle("")).toBe("")
  })
})

describe("titleSimilarity", () => {
  it("tunnistaa identtisen", () => {
    expect(titleSimilarity("finlandia talo", "finlandia talo")).toBe(1)
  })

  /*
   * Kirjoitusvirhe ei saa estaa tasmaytysta: meilla hanke on
   * "saneeeraus" ja Granlundilla "saneeraus".
   */
  it("kestaa yhden kirjaimen eron", () => {
    const a = normalizeTitle("Prisma Hyllykallion laajennus ja saneeraus")
    const b = normalizeTitle("Prisma Hyllykallion laajennus ja saneeeraus")
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.95)
  })

  it("erottaa eri hankkeet", () => {
    const a = normalizeTitle("Helsingin yliopiston Anatomian rakennus")
    const b = normalizeTitle("Helsingin yliopiston Porthania peruskorjaus")
    expect(titleSimilarity(a, b)).toBeLessThan(0.9)
  })

  /* Selvasti eripituiset eivat voi olla sama nimi. */
  it("hylkaa eripituiset heti", () => {
    expect(titleSimilarity("kansallismuseo", normalizeTitle("Kansallismuseon peruskorjaus ja laajennus, Helsinki, vaihe 2"))).toBe(0)
  })

  it("palauttaa nollan tyhjalle", () => {
    expect(titleSimilarity("", "jotain")).toBe(0)
    expect(titleSimilarity("jotain", "")).toBe(0)
  })
})

describe("competingTitles", () => {
  /*
   * Finlandia 28.8.2026: samasta talosta kaksi hanketta eri
   * vuosikymmenilta, joten kumpaakaan ei saa tasmayttaa.
   */
  it("tunnistaa saman rakennuksen kaksi hanketta", () => {
    const n = competingTitles("Finlandia Talo", [
      "Finlandia-talo",
      "Finlandiatalo perusparannus, AV-, esitystekniikan ja valaistuksen suunnittelu",
      "Tainionkosken kirkko",
    ])
    expect(n).toBe(2)
  })

  /* Kirjoitusvirheellinen mutta yksikasitteinen pari kelpaa. */
  it("paastaa yksikasitteisen lapi", () => {
    const n = competingTitles("Prisma Hyllykallion laajennus ja saneeeraus", [
      "Prisma Hyllykallion laajennus ja saneeraus",
      "Tainionkosken kirkko",
    ])
    expect(n).toBe(1)
  })

  it("kestaa tyhjan", () => {
    expect(competingTitles("", ["jotain"])).toBe(0)
    expect(competingTitles("jotain", [])).toBe(0)
  })
})
