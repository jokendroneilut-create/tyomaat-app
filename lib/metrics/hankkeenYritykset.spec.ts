import { describe, expect, it } from "vitest"

import {
  hankkeenOsapuolet,
  hankkeenYritykset,
  kentanNimet,
  osapuolenNimi,
} from "./hankkeenYritykset"
import { hankkeenYritysavaimet } from "./yritysavain"

describe("kentanNimet", () => {
  it("poistaa y-tunnuksen ja jakaa pilkusta", () => {
    expect(kentanNimet("Testi Oy (1234567-8), Toinen Ab (7654321-0)")).toEqual([
      "Testi Oy",
      "Toinen Ab",
    ])
  })

  it("ei jaa sulkujen sisalla olevasta pilkusta", () => {
    expect(kentanNimet("Suunnittelu Oy (rakenne, LVI)")).toEqual(["Suunnittelu Oy"])
  })
})

describe("hankkeenYritykset", () => {
  it("antaa roolit rakennuttajalle, urakoitsijalle ja osapuolille", () => {
    const tulos = hankkeenYritykset({
      developer: "Tilaaja Oy",
      builder: "Urakka Oy",
      metadata: { related_companies: ["Kattotyot Oy", "Arkkitehdit Ky"] },
    })
    expect(tulos.map((y) => [y.avain, y.rooli])).toEqual([
      ["tilaaja", "rakennuttaja"],
      ["urakka", "paaurakoitsija"],
      ["kattotyot", "osapuoli"],
      ["arkkitehdit", "osapuoli"],
    ])
  })

  it("lukee related_companies-rivin jossa on y-tunnus ja useampi nimi", () => {
    const tulos = hankkeenOsapuolet({
      metadata: { related_companies: ["Kattotyot Oy (1111111-1), Sahko Ab"] },
    })
    expect(tulos.map((y) => y.avain)).toEqual(["kattotyot", "sahko"])
  })

  it("liittaa aliurakoitsijan tyon osapuoleen", () => {
    const tulos = hankkeenOsapuolet({
      metadata: {
        related_companies: ["Kattotyot Oy", "Muu Oy"],
        aliurakoitsijat: [{ yritys: "Kattotyot Oy", tyo: "vesikattotyot" }],
      },
    })
    expect(tulos).toEqual([
      { avain: "kattotyot", nimi: "Kattotyot Oy", rooli: "osapuoli", tyo: "vesikattotyot" },
      { avain: "muu", nimi: "Muu Oy", rooli: "osapuoli", tyo: null },
    ])
  })

  it("ostajapuolen rooli voittaa: urakoitsija ei ole myos osapuoli", () => {
    const tulos = hankkeenYritykset({
      builder: "Urakka Oy",
      metadata: { related_companies: ["Urakka Oy", "URAKKA"] },
    })
    expect(tulos).toHaveLength(1)
    expect(tulos[0].rooli).toBe("paaurakoitsija")
  })

  it("sama yritys voi olla seka rakennuttaja etta urakoitsija", () => {
    const tulos = hankkeenYritykset({ developer: "Talo Oy", builder: "Talo Oy" })
    expect(tulos.map((y) => y.rooli)).toEqual(["rakennuttaja", "paaurakoitsija"])
  })

  it("sietaa puuttuvat ja vaaran muotoiset kentat", () => {
    expect(hankkeenYritykset({})).toEqual([])
    expect(
      hankkeenYritykset({ metadata: { related_companies: [null, 5, ""], aliurakoitsijat: "x" } })
    ).toEqual([])
  })

  /*
   * Osapuolen avain EI saa paatya ostajapuolen avaimiin: niita lukee
   * mittari (D-239) ja asiakkaan "yrityksen yhteyshenkilo".
   */
  it("ei muuta hankkeenYritysavaimet-funktion tulosta", () => {
    const hanke = {
      developer: "Tilaaja Oy",
      builder: null,
      metadata: { related_companies: ["Kattotyot Oy"] },
    }
    expect(hankkeenYritysavaimet(hanke)).toEqual(["tilaaja"])
  })
})

describe("osapuolenNimi", () => {
  it("merkitsee roolin nimen peraan", () => {
    expect(osapuolenNimi({ nimi: "Kattotyot Oy", tyo: null })).toBe("Kattotyot Oy (osapuoli)")
    expect(osapuolenNimi({ nimi: "Kattotyot Oy", tyo: "vesikattotyot" })).toBe(
      "Kattotyot Oy (vesikattotyot)"
    )
  })
})
