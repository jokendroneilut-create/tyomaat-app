import { describe, expect, it } from "vitest"

import { pietarsaariKaavaDescription } from "./pietarsaariKaavaDescription"

/* Varvetin kaava sellaisena kuin se sivulla on, 29.8.2026. */
const VARVET = [
  { tag: "h4", text: "Suunnittelualue" },
  { tag: "p", text: "Suunnittelualue sijaitsee noin 3 kilometrin etäisyydellä torilta. Alueella ei ole asemakaavaa." },
  { tag: "h4", text: "Suunnittelun tarkoitus" },
  { tag: "p", text: "Asemakaavan tavoitteena on mahdollistaa koko Varvetin tarkoituksenmukainen kehittäminen pientaloalueeksi" },
  { tag: "h4", text: "Osallistumis- ja arviointisuunnitelma" },
  { tag: "p", text: "OAS päivitetty 20.08.2026.pdf" },
  { tag: "h4", text: "Suunnittelija" },
  { tag: "p", text: "Pia Lähteenmäki" },
]

describe("pietarsaariKaavaDescription", () => {
  it("ottaa mukaan seka alueen etta tarkoituksen", () => {
    const kuvaus = pietarsaariKaavaDescription(VARVET)
    expect(kuvaus).toContain("Suunnittelualue sijaitsee")
    expect(kuvaus).toContain("mahdollistaa koko Varvetin")
  })

  /* Juuri tama jai ennen pois, ja se kertoo mita alueelle tulee. */
  it("ei jata tarkoitusta pois", () => {
    expect(pietarsaariKaavaDescription(VARVET)).toContain("pientaloalueeksi")
  })

  it("jattaa liitteet ja suunnittelijan pois", () => {
    const kuvaus = pietarsaariKaavaDescription(VARVET) ?? ""
    expect(kuvaus).not.toContain(".pdf")
    expect(kuvaus).not.toContain("Pia Lähteenmäki")
  })

  /*
   * Sivun muutos ei saa tyhjentaa kuvauksia huomaamatta: ilman
   * tunnistettuja otsikoita otetaan ensimmainen riittavan pitka kappale.
   */
  it("kayttaa varalla ensimmaista kappaletta", () => {
    const kuvaus = pietarsaariKaavaDescription([
      { tag: "h4", text: "Jokin uusi otsikko" },
      { tag: "p", text: "Tässä on riittävän pitkä kuvaus hankkeesta jotta se kelpaa varalle." },
    ])
    expect(kuvaus).toContain("riittävän pitkä kuvaus")
  })

  it("palauttaa nullin kun sisaltoa ei ole", () => {
    expect(pietarsaariKaavaDescription([])).toBeNull()
    expect(
      pietarsaariKaavaDescription([
        { tag: "h4", text: "Suunnittelija" },
        { tag: "p", text: "Pia Lähteenmäki" },
      ])
    ).toBeNull()
  })
})

describe("otsikko kappaleen sisalla", () => {
  /*
   * Osassa kaavoista otsikko ei ole omana elementtinaan vaan kappaleen
   * alussa: Permolan kuvaus alkoi ".Suunnittelun tarkoitus On todettu".
   */
  it("karsii otsikon kappaleen alusta", () => {
    const kuvaus = pietarsaariKaavaDescription([
      { tag: "h4", text: "Suunnittelualue" },
      { tag: "p", text: ".Suunnittelun tarkoitus On todettu tarve alueelle, jolle voidaan perustaa latauspiste." },
    ])
    expect(kuvaus).toBe("On todettu tarve alueelle, jolle voidaan perustaa latauspiste.")
  })
})
