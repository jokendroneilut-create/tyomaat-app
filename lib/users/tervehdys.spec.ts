import { describe, expect, it } from "vitest"

import { helsinginTunti, tervehdi, tervehdysTunnista } from "./tervehdys"

describe("tervehdysTunnista", () => {
  /*
   * Johannes 6.10.2026: "Kellonaikojen pitää olla siten että aina on joku
   * noista kolmesta." Tämä testi käy koko vuorokauden läpi.
   */
  it("antaa tervehdyksen jokaiselle tunnille", () => {
    for (let tunti = 0; tunti < 24; tunti++) {
      expect(["Huomenta", "Päivää", "Iltaa"]).toContain(tervehdysTunnista(tunti))
    }
  })

  it("rajat ovat 5, 10 ja 17", () => {
    expect(tervehdysTunnista(4)).toBe("Iltaa")
    expect(tervehdysTunnista(5)).toBe("Huomenta")
    expect(tervehdysTunnista(9)).toBe("Huomenta")
    expect(tervehdysTunnista(10)).toBe("Päivää")
    expect(tervehdysTunnista(16)).toBe("Päivää")
    expect(tervehdysTunnista(17)).toBe("Iltaa")
    expect(tervehdysTunnista(23)).toBe("Iltaa")
    expect(tervehdysTunnista(0)).toBe("Iltaa")
  })
})

describe("helsinginTunti", () => {
  /*
   * PALVELIN AJAA UTC:SSA. Ilman vyöhykettä kesäaikaan klo 7 Suomessa
   * olisi 4 UTC — eli "Iltaa" aamukahvilla.
   */
  it("lukee tunnin Helsingin vyöhykkeeltä, ei UTC:stä", () => {
    /* 2026-07-01 04:30 UTC = 07:30 Suomessa (kesäaika, UTC+3). */
    expect(helsinginTunti(new Date("2026-07-01T04:30:00Z"))).toBe(7)
    /* 2026-01-15 05:30 UTC = 07:30 Suomessa (talviaika, UTC+2). */
    expect(helsinginTunti(new Date("2026-01-15T05:30:00Z"))).toBe(7)
  })

  it("keskiyo on 0 eika 24", () => {
    expect(helsinginTunti(new Date("2026-07-01T21:30:00Z"))).toBe(0)
  })
})

describe("tervehdi", () => {
  const AAMU = new Date("2026-07-01T04:30:00Z")

  it("tervehtii nimella", () => {
    expect(tervehdi("Samu", AAMU)).toBe("Huomenta, Samu")
  })

  /* Pakotettu lomake estaa taman, mutta tervehdys ei saa silti rikkoutua. */
  it("tervehtii ilman nimea kun nimea ei ole", () => {
    expect(tervehdi(null, AAMU)).toBe("Huomenta")
    expect(tervehdi("", AAMU)).toBe("Huomenta")
    expect(tervehdi("   ", AAMU)).toBe("Huomenta")
  })
})
