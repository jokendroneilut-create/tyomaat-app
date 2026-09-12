import { describe, expect, it } from "vitest"

import { allativeToNominative } from "./companyName"

/*
 * PERUSMUOTO TODENNETAAN TEKSTISTÄ (D-188).
 *
 * Säännöt päättelevät perusmuodon päätteestä, ja päättely menee väärin aina
 * kun vartalo poikkeaa nominatiivista. Mitattu 12.9.2026: kannassa oli 18
 * riviä katkenneella rakennuttajanimellä. Oikea muoto on kuitenkin lähes
 * aina samassa tiedotteessa.
 */
describe("allativeToNominative - todennus kontekstista", () => {
  it("valitsee muodon joka esiintyy tekstissa", () => {
    const teksti = "Senaatti-kiinteistöt rakennuttaa Tullille uudisrakennuksen. Tullin tilat valmistuvat 2028. Tulli muuttaa Vantaalle."
    expect(allativeToNominative("Tullille", teksti)).toBe("Tulli")
  })

  it("lyhentaa pitkan vartalovokaalin kun teksti vahvistaa sen", () => {
    expect(allativeToNominative("Tampereelle", "Hanke sijaitsee Tampereelle rakennettavassa korttelissa. Tampere kasvaa.")).toBe(
      "Tampere"
    )
  })

  it("lukee -kse-vartalon nominatiivin", () => {
    const teksti = "Marvea rakentaa Kattokeskukselle toimitilat. Kattokeskus muuttaa uusiin tiloihin."
    expect(allativeToNominative("Kattokeskukselle", teksti)).toBe("Kattokeskus")
  })

  it("pudottaa sidevokaalin kun teksti vahvistaa sen", () => {
    expect(allativeToNominative("Fazerille", "Skanska rakentaa Fazerille tehtaan. Fazer investoi Lahteen.")).toBe(
      "Fazer"
    )
  })

  /*
   * Ilman vahvistusta palataan vanhoihin saantoihin: muuten "Fazerille"
   * hajoaisi silloin kun teksti puhuu vain "Fazerin" hankkeesta.
   */
  it("kayttaa vanhaa saantoa kun tekstissa ei ole perusmuotoa", () => {
    expect(allativeToNominative("Fazerille", "Skanska rakentaa Fazerille tehtaan Fazerin tontille.")).toBe("Fazer")
    expect(allativeToNominative("Fazerille")).toBe("Fazer")
  })

  /* Astevaihtelua ei arvata, ei myoskaan kontekstin kanssa. */
  it("jattaa astevaihtelun tyhjaksi", () => {
    expect(allativeToNominative("HOK-Elannolle", "S-ryhma rakentaa HOK-Elannolle myymalan.")).toBeNull()
  })

  it("ohittaa yleissanat", () => {
    expect(allativeToNominative("asiakkaalle", "Rakennetaan asiakkaalle.")).toBeNull()
    expect(allativeToNominative("kaupungille", "Rakennetaan kaupungille.")).toBeNull()
  })
})
