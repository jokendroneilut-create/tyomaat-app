import { describe, expect, it } from "vitest"

import { EI_OSAPUOLTA_KATEGORIAT, kuuluuJonoon } from "./osapuolettomienRajaus"

const RAJATUT = ["Espoon kuulutukset", "Lupapiste kuulutukset"]

describe("kuuluuJonoon", () => {
  it("rajaa pois lahteen joka ei nimea osapuolta", () => {
    expect(kuuluuJonoon("Espoon kuulutukset", RAJATUT)).toBe(false)
    expect(kuuluuJonoon("Lupapiste kuulutukset", RAJATUT)).toBe(false)
  })

  it("pitaa jonossa lahteen joka nimeaa osapuolen", () => {
    expect(kuuluuJonoon("rakennuslehti", RAJATUT)).toBe(true)
    expect(kuuluuJonoon("STT-tiedotteet (rakentaminen)", RAJATUT)).toBe(true)
  })

  /*
   * Lahteeton hanke on kasin lisatty. Mitattu 3.10.2026: niista 94 %:lla
   * on osapuoli, eli ne ovat juuri sita tyota jota jono on varten.
   */
  it("pitaa lahteettoman jonossa", () => {
    expect(kuuluuJonoon(null, RAJATUT)).toBe(true)
    expect(kuuluuJonoon("", RAJATUT)).toBe(true)
    expect(kuuluuJonoon("   ", RAJATUT)).toBe(true)
  })

  /* Virhetilanteessa lista on tyhja: silloin ei rajata ketaan pois. */
  it("ei rajaa mitaan tyhjalla listalla", () => {
    expect(kuuluuJonoon("Espoon kuulutukset", [])).toBe(true)
  })

  it("rajaus perustuu kategoriaan eika nimilistaan", () => {
    expect(EI_OSAPUOLTA_KATEGORIAT).toContain("building_permits")
    expect(EI_OSAPUOLTA_KATEGORIAT).toContain("municipality_notices")
  })
})
