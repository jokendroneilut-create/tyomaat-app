import { describe, expect, it } from "vitest"

import {
  NOLLARIVIEN_LAHTOTASO,
  NOLLATTUJEN_KENTTA,
  odotetutNollarivit,
  selittamattomatNollarivit,
} from "./tunnistamattomat"

const poisto = (maara?: number) => ({
  event: "deleted",
  metadata: maara == null ? { source: "admin_delete_user" } : { [NOLLATTUJEN_KENTTA]: maara },
})

describe("odotetutNollarivit", () => {
  it("palauttaa lähtötason ilman poistoja", () => {
    expect(odotetutNollarivit([])).toBe(NOLLARIVIEN_LAHTOTASO)
  })

  it("laskee poistojen kirjaamat määrät lähtötason päälle", () => {
    expect(odotetutNollarivit([poisto(12), poisto(30)])).toBe(NOLLARIVIEN_LAHTOTASO + 42)
  })

  /*
   * Ennen 10.9.2026 tehdyillä poistoilla kenttää ei ole, ja ne sisältyvät
   * jo lähtötasoon. Niiden laskeminen uudestaan nostaisi odotusta ja
   * vaimentaisi hälytyksen liikaa.
   */
  it("ei laske poistoa jolta määrä puuttuu", () => {
    expect(odotetutNollarivit([poisto(), poisto(5)])).toBe(NOLLARIVIEN_LAHTOTASO + 5)
  })

  it("ohittaa muut elinkaaritapahtumat", () => {
    const rivit = [{ event: "created", metadata: { [NOLLATTUJEN_KENTTA]: 999 } }, poisto(3)]
    expect(odotetutNollarivit(rivit)).toBe(NOLLARIVIEN_LAHTOTASO + 3)
  })

  it("sietää roskan metadatassa", () => {
    const rivit = [
      { event: "deleted", metadata: null },
      { event: "deleted", metadata: { [NOLLATTUJEN_KENTTA]: "kaksi" } },
      { event: "deleted", metadata: { [NOLLATTUJEN_KENTTA]: -4 } },
    ]
    expect(odotetutNollarivit(rivit as any)).toBe(NOLLARIVIEN_LAHTOTASO)
  })
})

describe("selittamattomatNollarivit", () => {
  it("on nolla kun poistot selittävät kaiken", () => {
    expect(selittamattomatNollarivit(1511, 1511)).toBe(0)
  })

  /* Tämä on se tapaus jonka takia mittari on olemassa (D-083). */
  it("kertoo ylityksen kun kirjoittaja on tuntematon", () => {
    expect(selittamattomatNollarivit(1600, 1511)).toBe(89)
  })

  /* Rivien väheneminen ei ole hälytys. */
  it("ei palauta negatiivista", () => {
    expect(selittamattomatNollarivit(1400, 1511)).toBe(0)
  })
})
