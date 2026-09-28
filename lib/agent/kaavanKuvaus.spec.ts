import { describe, expect, it } from "vitest"

import { kaavanKuvausTekstista } from "./kaavanKuvaus"

/*
 * Otos Savonlinnan teknologiapuiston selostuksesta (LUONNOS 25.8.2026),
 * mukana sivutunnisteet ja tavutus sellaisina kuin pdf-parse ne antaa.
 */
const SELOSTUS = [
  "Savonlinnan kaupunkiLUONNOS 25.8.2026",
  "Kaavoituspalvelut",
  "sivu 2 / 42",
  "1.1 Kaava-alue",
  "Teknologiapuisto Noheva sijaitsee Savonlinnan taajama-alueella, noin",
  "kaksi kilometria Kauppatorilta itaan, kaupunginosassa 10.",
  "Kaavamuutosalueen pinta-ala on noin 9,6 ha.",
  "1.2 Kaavan tarkoitus",
  "Tavoitteena on tehostaa maankayttoa ja mahdollistaa nopeasti kasvaneen",
  "teknologiakeskittyman kehittyminen ja laajentuminen.",
  "Kaupunki on ostanut noin hehtaarin laajuisen maaraalan Andritzilta joulu-",
  "kuussa 2023.",
  "1.3 Suunnittelutyo",
  "Asemakaavan muutos on laadittu Savonlinnan kaupungin kaavoituspalveluissa.",
].join("\n")

describe("kaavanKuvausTekstista", () => {
  it("poimii kaava-alueen ja kaavan tarkoituksen", () => {
    const kuvaus = kaavanKuvausTekstista(SELOSTUS)!

    expect(kuvaus).toContain("Teknologiapuisto Noheva sijaitsee")
    expect(kuvaus).toContain("Tavoitteena on tehostaa maankayttoa")
  })

  /* Suunnittelutyo on eri kysymys eika kuulu kuvaukseen. */
  it("ei ota mukaan muita lukuja", () => {
    expect(kaavanKuvausTekstista(SELOSTUS)).not.toContain("laadittu Savonlinnan")
  })

  /* "joulu-\nkuussa" on yksi sana, ei kaksi. */
  it("yhdistaa rivin lopun tavutuksen", () => {
    expect(kaavanKuvausTekstista(SELOSTUS)).toContain("joulukuussa 2023")
  })

  it("pudottaa toistuvat sivutunnisteet", () => {
    const kuvaus = kaavanKuvausTekstista(SELOSTUS)!
    expect(kuvaus).not.toContain("sivu 2 / 42")
  })

  it("palauttaa null kun lukuja ei ole", () => {
    expect(kaavanKuvausTekstista("Kaavakartta 1:2000")).toBeNull()
    expect(kaavanKuvausTekstista("")).toBeNull()
    expect(kaavanKuvausTekstista(null)).toBeNull()
  })

  /* Otsikko ilman sisaltoa ei ole kuvaus. */
  it("ohittaa liian lyhyen luvun", () => {
    const lyhyt = ["1.2 Kaavan tarkoitus", "Ks. liite 1.", "1.3 Muuta"].join("\n")
    expect(kaavanKuvausTekstista(lyhyt)).toBeNull()
  })

  it("katkaisee pitkan kuvauksen virkkeen rajalta", () => {
    const pitka = [
      "1.2 Kaavan tarkoitus",
      ("Tavoitteena on rakentaa alueelle uusi asuinkortteli palveluineen. " as string).repeat(40),
    ].join("\n")

    const kuvaus = kaavanKuvausTekstista(pitka)!
    expect(kuvaus.length).toBeLessThanOrEqual(1200)
    expect(kuvaus.endsWith(".")).toBe(true)
  })
})
