import { describe, expect, it } from "vitest"

import { TUORE_KUUKAUDET, evaluateEffectiveZoning } from "./effectiveZoning"

const NYT = new Date("2026-08-30T12:00:00Z")
const kkSitten = (n: number) => {
  const d = new Date(NYT)
  d.setUTCMonth(d.getUTCMonth() - n)
  return d.toISOString().slice(0, 10)
}

const perus = { now: NYT, phase: "Kaavoitus", tila: "voimassa" }

describe("evaluateEffectiveZoning", () => {
  it("siirtaa tuoreen lainvoimaisen kaavan eteenpain", () => {
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: kkSitten(3) })).toBe("advance")
  })

  /* Vuosikymmenen takainen kaava on rakennettu tai ei toteudu. */
  it("ei siirra vanhaa kaavaa", () => {
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: kkSitten(TUORE_KUUKAUDET + 2) })).toBe("keep")
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: "2012-05-04" })).toBe("keep")
  })

  it("kohtelee kynnysta mukaan lukevana", () => {
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: kkSitten(TUORE_KUUKAUDET) })).toBe("advance")
  })

  /*
   * Kumottu kaava ei toteudu, ja keskenerainen ei ole lainvoimainen.
   * Molemmat kantoivat aiemmin samaa completed-lippua.
   */
  it("ei siirra kumottua eika keskenerraista", () => {
    expect(evaluateEffectiveZoning({ ...perus, tila: "kumottu", voimaantulo: kkSitten(1) })).toBe("keep")
    expect(evaluateEffectiveZoning({ ...perus, tila: "kesken", voimaantulo: kkSitten(1) })).toBe("keep")
    expect(evaluateEffectiveZoning({ ...perus, tila: null, voimaantulo: kkSitten(1) })).toBe("keep")
  })

  /* Ilman paivaa ei tiedeta onko lainvoima tuore: mieluummin tyhja kuin vaara. */
  it("ei siirra ilman voimaantulopaivaa", () => {
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: null })).toBe("keep")
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: "ei paiva" })).toBe("keep")
  })

  /* Saanto ei saa vetaa pidemmalla olevaa hanketta taaksepain. */
  it("ei koske hankkeeseen joka on jo pidemmalla", () => {
    for (const vaihe of ["Rakennuslupa", "Kilpailutus", "Rakenteilla", "Valmistunut", "Suunnittelu"]) {
      expect(evaluateEffectiveZoning({ ...perus, phase: vaihe, voimaantulo: kkSitten(1) })).toBe("keep")
    }
  })

  it("tunnistaa myos vanhan vaihenimen", () => {
    expect(evaluateEffectiveZoning({ ...perus, phase: "Suunnittelussa", voimaantulo: kkSitten(1) })).toBe("keep")
  })

  /* Tulevaisuuden paiva on poimintavirhe, ei lainvoima. */
  it("ei siirra tulevaisuuden paivalla", () => {
    expect(evaluateEffectiveZoning({ ...perus, voimaantulo: "2027-01-01" })).toBe("keep")
  })
})
