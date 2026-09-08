import { describe, expect, it } from "vitest"

import { etaisyysMetreina, naapurisolut, solu } from "./etaisyys"

describe("etaisyysMetreina", () => {
  /*
   * Kayttajan loytama pari: 60.9645711 vs 60.9645712, sama pituusaste.
   * Sama rakennus, mutta tasmaytys ei nahnyt mitaan.
   */
  it("tunnistaa saman rakennuksen", () => {
    const d = etaisyysMetreina(
      { lat: 60.9645711, lon: 25.66597 },
      { lat: 60.9645712, lon: 25.66597 }
    )
    expect(d).toBeLessThan(1)
  })

  it("laskee lyhyen matkan oikein", () => {
    /* 0,001 astetta leveyspiirilla on noin 111 m. */
    const d = etaisyysMetreina({ lat: 60.0, lon: 25.0 }, { lat: 60.001, lon: 25.0 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(118)
  })

  it("laskee pitkan matkan oikein", () => {
    /* Helsinki - Tampere on linnuntietta noin 160 km. */
    const d = etaisyysMetreina({ lat: 60.1699, lon: 24.9384 }, { lat: 61.4978, lon: 23.761 })
    expect(d).toBeGreaterThan(150_000)
    expect(d).toBeLessThan(175_000)
  })

  it("on nolla samalle pisteelle", () => {
    expect(etaisyysMetreina({ lat: 60.1, lon: 24.9 }, { lat: 60.1, lon: 24.9 })).toBe(0)
  })
})

describe("solu ja naapurisolut", () => {
  it("antaa saman solun lahekkaisille pisteille", () => {
    expect(solu({ lat: 60.96457, lon: 25.66597 })).toBe(solu({ lat: 60.96458, lon: 25.66599 }))
  })

  /*
   * Solurajan eri puolilla olevat pisteet voivat olla metrien paassa,
   * joten naapurisolut on kaytava lapi.
   */
  it("kattaa yhdeksan solua ja sisaltaa oman", () => {
    const p = { lat: 60.9645, lon: 25.6659 }
    const n = naapurisolut(p)
    expect(n).toHaveLength(9)
    expect(n).toContain(solu(p))
  })

  it("sisaltaa solurajan yli olevan naapurin", () => {
    const a = { lat: 60.96049, lon: 25.0 }
    const b = { lat: 60.96051, lon: 25.0 }
    expect(solu(a)).not.toBe(solu(b))
    expect(naapurisolut(a)).toContain(solu(b))
  })
})
