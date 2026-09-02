import { describe, expect, it } from "vitest"

import { eraNakyma } from "./naytaLisaa"

const rivit = (n: number) => Array.from({ length: n }, (_, i) => i)

describe("eraNakyma", () => {
  it("nayttaa ensimmaisen eran ja kertoo montako on jaljella", () => {
    const t = eraNakyma({ rivit: rivit(100), nakyvissa: 20, kaikkiPisteytetyt: 100 })
    expect(t.nakyvat).toHaveLength(20)
    expect(t.jaljella).toBe(80)
    expect(t.lataamatta).toBe(0)
  })

  it("ei jata mitaan jaljelle kun kaikki on naytetty", () => {
    const t = eraNakyma({ rivit: rivit(35), nakyvissa: 40, kaikkiPisteytetyt: 35 })
    expect(t.nakyvat).toHaveLength(35)
    expect(t.jaljella).toBe(0)
  })

  /*
   * Palvelin lataa sata rivia vaikka pisteytettyja olisi tuhat - loput
   * ovat hankelistauksessa, eika nappi saa luvata niita.
   */
  it("erottaa lataamattomat jaljella olevista", () => {
    const t = eraNakyma({ rivit: rivit(100), nakyvissa: 100, kaikkiPisteytetyt: 1000 })
    expect(t.jaljella).toBe(0)
    expect(t.lataamatta).toBe(900)
  })

  it("kestaa tyhjan listan", () => {
    const t = eraNakyma({ rivit: [], nakyvissa: 20 })
    expect(t.nakyvat).toEqual([])
    expect(t.jaljella).toBe(0)
    expect(t.lataamatta).toBe(0)
  })

  /* Peukku alas piilottaa rivin, jolloin ladattujen maara pienenee. */
  it("laskee jaljella olevat piilotusten jalkeen", () => {
    const t = eraNakyma({ rivit: rivit(22), nakyvissa: 20, kaikkiPisteytetyt: 100 })
    expect(t.jaljella).toBe(2)
  })
})
