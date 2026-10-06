import { describe, expect, it } from "vitest"

import { MITTARI, mittarinKulma, mittarinPiste } from "./mittarinGeometria"

describe("mittarinGeometria", () => {
  it("nolla osoittaa vasemmalle ja sata oikealle", () => {
    expect(mittarinKulma(0)).toBeCloseTo(Math.PI)
    expect(mittarinKulma(1)).toBeCloseTo(0)
  })

  it("puolivali osoittaa suoraan ylos", () => {
    const p = mittarinPiste(0.5, MITTARI.sade)
    expect(p.x).toBeCloseTo(MITTARI.keskiX)
    expect(p.y).toBeCloseTo(MITTARI.keskiY - MITTARI.sade)
  })

  /* Neula ei saa karata taulun ulkopuolelle virheellisellakaan arvolla. */
  it("rajaa arvon valille 0-1", () => {
    expect(mittarinKulma(-0.5)).toBeCloseTo(Math.PI)
    expect(mittarinKulma(1.5)).toBeCloseTo(0)
  })

  it("kasvava osuus siirtaa neulaa oikealle", () => {
    const a = mittarinPiste(0.3, MITTARI.sade)
    const b = mittarinPiste(0.7, MITTARI.sade)
    expect(b.x).toBeGreaterThan(a.x)
  })
})
