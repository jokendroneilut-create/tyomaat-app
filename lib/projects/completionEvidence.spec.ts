import { describe, it, expect } from "vitest"
import { completionEvidence } from "./completionEvidence"

describe("completionEvidence", () => {
  /*
   * MITATTU TAPAUS. Abraham Wetterin tien paivakodin tarveselvitys
   * (8/2021) lupasi kayttoonoton 8/2023. Urakoitsijan mukaan kohde
   * luovutettiin kayttajille 8/2025 - kaksi vuotta myohemmin. Tavoitteen
   * kirjoittaminen kenttaan olisi merkinnyt hankkeen valmiiksi silloin
   * kun tyomaa oli vasta alkamassa.
   */
  it("pitaa tarveselvityksen paivaa tavoitteena", () => {
    expect(
      completionEvidence({
        title: "Abraham Wetterin tien päiväkodin uudisrakennuksen tarveselvitys",
        decisionDate: "2021-08-17",
        completionDate: "2023-08-31",
      })
    ).toBe("target")
  })

  it("pitaa hankesuunnitelman ja lausunnon paivaa tavoitteena", () => {
    expect(
      completionEvidence({
        title: "Päiväkoti Myllytuvan korvaavan uudisrakennuksen hankesuunnitelma",
        decisionDate: "2026-01-01",
        completionDate: "2026-06-30",
      })
    ).toBe("target")

    expect(
      completionEvidence({
        title: "Kasvatus- ja koulutuslautakunnan lausunto tilahankkeesta",
        decisionDate: "2026-01-01",
        completionDate: "2026-06-30",
      })
    ).toBe("target")
  })

  /*
   * KAUKAINEN LUPAUS ON TAVOITE VAIKKA OTSIKKO EI KERTOISI VAIHETTA.
   * Mitattu: 75 jonorivia 218:sta lupaa yli 18 kuukautta eteenpain.
   */
  it("pitaa yli 18 kk paassa olevaa lupausta tavoitteena", () => {
    expect(
      completionEvidence({
        title: "Uimahallin peruskorjaus",
        decisionDate: "2021-01-01",
        completionDate: "2024-01-31",
      })
    ).toBe("target")
  })

  it("pitaa lahella olevaa paivaa aikatauluna", () => {
    expect(
      completionEvidence({
        title: "Urakan valmistuminen",
        decisionDate: "2025-01-01",
        completionDate: "2025-09-30",
      })
    ).toBe("schedule")
  })

  /*
   * VALMISTUMINEN ENNEN PAATOSTA ON MAHDOTON. Mitattu: jonossa oli
   * rivi jolla ero oli -124 kuukautta - poimintavirhe, ei aikataulu.
   */
  it("hylkaa paivan joka on ennen paatosta", () => {
    expect(
      completionEvidence({
        title: "Kauppakadun peruskorjauksen hankesuunnitelma",
        decisionDate: "2025-09-15",
        completionDate: "2024-10-31",
      })
    ).toBe("impossible")
  })

  it("hylkaa tyhjan paivan", () => {
    expect(
      completionEvidence({ title: "Urakka", decisionDate: "2025-01-01", completionDate: null })
    ).toBe("impossible")
  })

  /*
   * Ilman paatospaivaa ei voi arvioida etaisyytta, joten otsikko
   * ratkaisee yksin - tiedotteissa ei ole paatospaivaa lainkaan.
   */
  it("toimii ilman paatospaivaa", () => {
    expect(
      completionEvidence({
        title: "Urakka valmistuu syyskuussa",
        decisionDate: null,
        completionDate: "2025-09-30",
      })
    ).toBe("schedule")
  })
})
