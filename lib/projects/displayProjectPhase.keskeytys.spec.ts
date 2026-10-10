import { describe, it, expect } from "vitest"
import { displayProjectPhase } from "./phases"

/*
 * Keskeytysmerkinta puuttui Tanaan-suosituslistasta 10.10.2026: se
 * naytti raakaa `phase`-kenttaa. Nama testit pitavat huolen siita etta
 * merkinta on olemassa ja ettei se levia vaariin vaiheisiin.
 */
describe("displayProjectPhase: keskeytysmerkinta", () => {
  it("merkitsee keskeytetyn kilpailutuksen", () => {
    expect(displayProjectPhase("Kilpailutus", true)).toBe("Kilpailutus (keskeytetty)")
  })

  it("ei merkitse kilpailutusta joka on kesken", () => {
    expect(displayProjectPhase("Kilpailutus", false)).toBe("Kilpailutus")
    expect(displayProjectPhase("Kilpailutus", undefined)).toBe("Kilpailutus")
  })

  /*
   * Lippu voi jaada metadataan vaikka vaihe on edennyt. Silloin
   * merkinta olisi vaara: hanke EI ole keskeytetty, se on rakenteilla.
   */
  it("ei merkitse muita vaiheita vaikka lippu olisi paalla", () => {
    expect(displayProjectPhase("Rakenteilla", true)).toBe("Rakenteilla")
    /* Kanoninen nimi on "Suunnittelu"; olennaista on ettei perassa lue (keskeytetty). */
    expect(displayProjectPhase("Suunnittelussa", true)).toBe("Suunnittelu")
  })

  /* Totuusarvo on tarkka: merkkijono "true" ei riita. */
  it("vaatii boolean-arvon", () => {
    expect(displayProjectPhase("Kilpailutus", "true")).toBe("Kilpailutus")
  })
})
