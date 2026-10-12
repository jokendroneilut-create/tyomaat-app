import { describe, expect, it } from "vitest"

import { hankkeenLaajuus } from "./hankkeenLaajuus"

/*
 * Kaikki tapaukset ovat kannasta luettuja otsikoita 12.10.2026
 * (D-274). Luokka erottaa hinnan 24-kertaisesti: uudisrakennuksen
 * mediaani 8,4 M€, osaurakan 350 k€.
 */
describe("hankkeenLaajuus", () => {
  it("tunnistaa osaurakan tekniikkalajista", () => {
    expect(hankkeenLaajuus("Linjasaneeraus, Munkkiluodonkuja")).toBe("osaurakka")
    expect(hankkeenLaajuus("931525 HUSK Sprinklerijärjestelmien hankinta")).toBe("osaurakka")
    expect(hankkeenLaajuus("Peltikattosaneeraukset, Sonkakoti Oy")).toBe("osaurakka")
  })

  it("EI pida sanaa hankinta osaurakan merkkina", () => {
    /*
     * Hilman otsikot paattyvat sanaan "hankinta" myos kokonaisista
     * rakennuksista. Tama on kokonainen asema vuokramallilla.
     */
    expect(
      hankkeenLaajuus("Ruoveden pelastus- ja ensihoitoaseman hankinta vuokramallilla")
    ).not.toBe("osaurakka")
  })

  it("tunnistaa purun omaksi lajikseen", () => {
    expect(hankkeenLaajuus("Kerrostalojen purku Mäntässä")).toBe("purku")
    expect(hankkeenLaajuus("Kirjalansalmen vanhan sillan purku")).toBe("purku")
  })

  it("tunnistaa korjauksen", () => {
    expect(hankkeenLaajuus("Kaupungintalon saneeraus")).toBe("korjaus")
    expect(hankkeenLaajuus("Jyväskylän torin kunnostus")).toBe("korjaus")
  })

  it("laajennus voittaa korjauksen kun otsikossa on molemmat", () => {
    /* Hinta maaraytyy laajennuksesta, ei perusparannuksesta. */
    expect(hankkeenLaajuus("Itä-Hakkilan koulun perusparannus ja laajennus")).toBe(
      "laajennus"
    )
  })

  it("tunnistaa uudisrakennuksen", () => {
    expect(hankkeenLaajuus("Uusi kerrostalo rakentuu Ruissalontielle")).toBe(
      "uudisrakennus"
    )
    expect(hankkeenLaajuus("Uusi tehdasalue Riihimäelle")).toBe("uudisrakennus")
  })

  it("kaavoitus tunnistetaan ennen muita", () => {
    /* "Taydennysrakentaminen" ei tee kaavasta uudisrakennushanketta. */
    expect(
      hankkeenLaajuus("XVI (Tammela), Itsenäisyydenkatu 17, täydennysrakentaminen, asemakaava")
    ).toBe("kaavoitus")
  })

  it("palauttaa nullin kun otsikko ei kerro", () => {
    expect(hankkeenLaajuus("Neulastie 3")).toBeNull()
    expect(hankkeenLaajuus("")).toBeNull()
    expect(hankkeenLaajuus(null)).toBeNull()
  })
})
