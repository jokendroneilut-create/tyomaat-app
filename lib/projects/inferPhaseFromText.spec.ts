import { describe, it, expect } from "vitest"
import { inferPhaseFromText } from "./inferPhaseFromText"
import { PHASE_LABELS, phaseAdvances } from "./phases"

/*
 * Nama testit kuvaavat SAANNON jota importCandidate soveltaa: teksti saa
 * viedä vaihetta eteenpain, muttei taaksepain eika paatevaiheisiin.
 * Itse paattely on yhden rivin avainsanahaku, joten arvo on siina etta
 * suunta ja rajaus pysyvat voimassa.
 */
const TERMINAL = new Set([PHASE_LABELS.completed, PHASE_LABELS.cancelled])

function resolvePhase(sourcePhase: string | null, text: string): string {
  const key = inferPhaseFromText(null, text, null)
  const inferred = key ? PHASE_LABELS[key] : null

  const mayAdvance =
    inferred !== null && !TERMINAL.has(inferred) && phaseAdvances(sourcePhase, inferred)

  return mayAdvance ? inferred : sourcePhase || inferred || PHASE_LABELS.planning
}

describe("inferPhaseFromText", () => {
  /*
   * MITATTU TAPAUS. Rakennuslehti 14.8.2026: "Nyab rakentaa sahkoaseman
   * Forssaan", kuvaus "Rakentaminen alkaa elokuussa ja valmista on
   * vuonna 2028." Rivi sai lahteen oletuksen "Suunnittelussa", vaikka
   * avainsana "rakentaminen alkaa" on sanastossa.
   */
  it("tunnistaa rakentamisen alkamisen", () => {
    expect(
      inferPhaseFromText(null, "Rakentaminen alkaa elokuussa ja valmista on vuonna 2028.", null)
    ).toBe("construction")
  })

  it("vie lahteen oletuksen eteenpain", () => {
    expect(
      resolvePhase("Suunnittelussa", "Rakentaminen alkaa elokuussa.")
    ).toBe(PHASE_LABELS.construction)
  })

  /*
   * SUUNTA ON YKSISUUNTAINEN. Uusi tieto voi kertoa hankkeen edenneen,
   * muttei palanneen - sama periaate kuin tasmaytyksessa.
   */
  it("ei palauta vaihetta taaksepain", () => {
    expect(resolvePhase("Rakenteilla", "Alueen asemakaava hyvaksyttiin aiemmin.")).toBe(
      "Rakenteilla"
    )
  })

  /*
   * PAATEVAIHE VAATII LAHTEEN OMAN PAATELMAN. Sanassa "valmistui" on
   * sama ansa kuin kohdetyypissa ja valmistumisajassa: tiedotteissa se
   * tarkoittaa lahes aina kohteen alkuperaista rakennusvuotta.
   */
  it("ei merkitse valmistuneeksi pelkan avainsanan perusteella", () => {
    expect(
      resolvePhase("Suunnittelussa", "Nykyinen rakennus valmistui 1976 ja on kayttoikansa paassa.")
    ).toBe("Suunnittelussa")
  })

  it("ei merkitse perutuksi pelkan avainsanan perusteella", () => {
    expect(resolvePhase("Suunnittelussa", "Aiempi hanke keskeytettiin 2019.")).toBe(
      "Suunnittelussa"
    )
  })

  it("kayttaa tekstia kun lahde ei anna vaihetta", () => {
    expect(resolvePhase(null, "Rakentaminen alkaa elokuussa.")).toBe(
      PHASE_LABELS.construction
    )
  })

  it("palautuu oletukseen kun mitaan ei loydy", () => {
    expect(resolvePhase(null, "Hankkeesta tiedotetaan myohemmin.")).toBe(
      PHASE_LABELS.planning
    )
  })
})
