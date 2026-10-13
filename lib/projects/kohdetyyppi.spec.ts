import { describe, expect, it } from "vitest"

import {
  TYYPPI_PUUTTUU,
  TYYPPI_PUUTTUU_AVAIN,
  kohdetyypinSelite,
  kohdetyyppiHakuvahdille,
  laskeKohdetyypit,
  osuukoKohdetyyppi,
} from "./kohdetyyppi"

const rivi = (property_type: string | null) => ({ property_type })

describe("laskeKohdetyypit", () => {
  it("yhdistaa kirjoitusasut ja nimeaa ryhman yleisimmalla", () => {
    const luvut = laskeKohdetyypit([
      rivi("Koulu"),
      rivi("Koulu"),
      rivi("Koulu"),
      rivi("koulu"),
    ])

    expect(luvut).toHaveLength(1)
    expect(luvut[0].nimi).toBe("Koulu")
    expect(luvut[0].lkm).toBe(4)
    expect(luvut[0].kirjoitusasut).toEqual(["Koulu", "koulu"])
  })

  it("jarjestaa suurimmasta pienimpaan", () => {
    const luvut = laskeKohdetyypit([
      rivi("Koulu"),
      rivi("Kerrostalo"),
      rivi("Kerrostalo"),
      rivi("Kerrostalo"),
      rivi("Päiväkoti"),
      rivi("Päiväkoti"),
    ])

    expect(luvut.map((l) => [l.nimi, l.lkm])).toEqual([
      ["Kerrostalo", 3],
      ["Päiväkoti", 2],
      ["Koulu", 1],
    ])
  })

  it("pitaa tyypittomat listassa mutta viimeisena vaikka ne ovat suurin joukko", () => {
    const luvut = laskeKohdetyypit([
      rivi(null),
      rivi(null),
      rivi(null),
      rivi("  "),
      rivi("Koulu"),
    ])

    expect(luvut.map((l) => l.nimi)).toEqual(["Koulu", TYYPPI_PUUTTUU])
    expect(luvut[1].lkm).toBe(4)
  })

  it("ei valita tyhjasta aineistosta", () => {
    expect(laskeKohdetyypit([])).toEqual([])
  })
})

describe("osuukoKohdetyyppi", () => {
  it("tyhja valinta ei rajaa", () => {
    expect(osuukoKohdetyyppi("Koulu", [])).toBe(true)
    expect(osuukoKohdetyyppi(null, [])).toBe(true)
  })

  it("osuu kirjainkoosta riippumatta", () => {
    expect(osuukoKohdetyyppi("koulu", ["Koulu"])).toBe(true)
    expect(osuukoKohdetyyppi("Koulu", ["koulu"])).toBe(true)
  })

  it("ei osu toiseen tyyppiin", () => {
    expect(osuukoKohdetyyppi("Kerrostalo", ["Koulu"])).toBe(false)
  })

  it("tyypiton osuu vain tyypittomien valintaan", () => {
    expect(osuukoKohdetyyppi(null, [TYYPPI_PUUTTUU])).toBe(true)
    expect(osuukoKohdetyyppi("", [TYYPPI_PUUTTUU])).toBe(true)
    expect(osuukoKohdetyyppi(null, ["Koulu"])).toBe(false)
    expect(osuukoKohdetyyppi("Koulu", [TYYPPI_PUUTTUU])).toBe(false)
  })

  it("lukee myos hakuvahtiin tallennetun tunnisteen", () => {
    expect(osuukoKohdetyyppi(null, [TYYPPI_PUUTTUU_AVAIN])).toBe(true)
  })
})

describe("kohdetyyppiHakuvahdille", () => {
  const aineisto = [rivi("Koulu"), rivi("Koulu"), rivi("koulu"), rivi("Kerrostalo"), rivi(null)]

  it("tyhja valinta ei tallenna rajausta", () => {
    expect(kohdetyyppiHakuvahdille([], aineisto)).toBeNull()
  })

  it("laajentaa valinnan kaikkiin kirjoitusasuihin", () => {
    expect(kohdetyyppiHakuvahdille(["Koulu"], aineisto)).toEqual(["Koulu", "koulu"])
  })

  it("kirjoittaa tyypittomat tunnisteena, ei nimilappuna", () => {
    /*
     * Tama on koko tunnisteen syy: `property_type = 'Ei tyyppia'` ei
     * osu kannassa yhteenkaan riviin.
     */
    expect(kohdetyyppiHakuvahdille([TYYPPI_PUUTTUU], aineisto)).toEqual([TYYPPI_PUUTTUU_AVAIN])
  })

  it("sailyttaa valinnan jota ei enaa ole aineistossa", () => {
    expect(kohdetyyppiHakuvahdille(["Kylpylä"], aineisto)).toEqual(["Kylpylä"])
  })
})

describe("kohdetyypinSelite", () => {
  it("ei rivia ilman rajausta", () => {
    expect(kohdetyypinSelite(null)).toBeNull()
    expect(kohdetyypinSelite([])).toBeNull()
    expect(kohdetyypinSelite("")).toBeNull()
  })

  it("lukee vanhan yksittaisen merkkijonon", () => {
    expect(kohdetyypinSelite("Koulu")).toBe("Kohdetyyppi: Koulu")
  })

  it("luhistaa kirjoitusasut", () => {
    expect(kohdetyypinSelite(["Koulu", "koulu", "Kerrostalo"])).toBe(
      "Kohdetyyppi: Koulu, Kerrostalo"
    )
  })

  it("ei paasta tunnistetta sahkopostiin", () => {
    expect(kohdetyypinSelite([TYYPPI_PUUTTUU_AVAIN])).toBe(`Kohdetyyppi: ${TYYPPI_PUUTTUU}`)
  })
})
