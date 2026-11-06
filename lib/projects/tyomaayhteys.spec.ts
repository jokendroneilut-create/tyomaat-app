import { describe, expect, it } from "vitest"

import { eiTyomaaRooli } from "./tyomaayhteys"

describe("eiTyomaaRooli", () => {
  /*
   * Nama nimikkeet olivat rekisterissa 7.11.2026 ja nakyivat asiakkaalle
   * yritystason varareitilla.
   */
  it("tunnistaa viestinnan myos taivutettuna", () => {
    expect(eiTyomaaRooli("viestinnän asiantuntija, SRV")).toBe(true)
    expect(eiTyomaaRooli("viestintäpäällikkö")).toBe(true)
    expect(eiTyomaaRooli("tiedottaja")).toBe(true)
  })

  it("tunnistaa myyntiroolit", () => {
    expect(eiTyomaaRooli("myyntipäällikkö, LKV, LVV (Tampere)")).toBe(true)
    expect(eiTyomaaRooli("asuntomyyjä, YKV, LKV")).toBe(true)
    expect(eiTyomaaRooli("Sales Manager, Electricity Networks")).toBe(true)
    expect(eiTyomaaRooli("kaupallinen johtaja")).toBe(true)
  })

  it("tunnistaa hallinnon", () => {
    expect(eiTyomaaRooli("Talousjohtaja")).toBe(true)
    expect(eiTyomaaRooli("Rekrytointipäällikkö")).toBe(true)
    expect(eiTyomaaRooli("Henkilöstöpäällikkö")).toBe(true)
    expect(eiTyomaaRooli("transaktiojohtaja, SRV")).toBe(true)
  })

  /* Nama ovat juuri se vaki jota haetaan. */
  it("ei hylkaa tyomaan ihmisia", () => {
    for (const n of [
      "Työpäällikkö, Etelä-Suomi",
      "Työmaapäällikkö",
      "Projektipäällikkö",
      "Vastaava työnjohtaja",
      "Rakennuttajainsinööri",
      "Siltainsinööri",
      "päällysteinsinööri",
      "hankejohtaja",
      "liiketoimintajohtaja, (Tampere)",
      "aluejohtaja, Lounais-Suomi, SRV",
    ]) {
      expect(eiTyomaaRooli(n), n).toBe(false)
    }
  })

  /*
   * Pienessa yhtiossa toimitusjohtaja on lahin ihminen joka vastaa
   * tyomaasta; rekisterissa heita on 14 ja ne ovat oikein (D-372).
   */
  it("ei hylkaa toimitusjohtajaa", () => {
    expect(eiTyomaaRooli("Toimitusjohtaja")).toBe(false)
    expect(eiTyomaaRooli("Toimitusjohtaja / yrittäjä")).toBe(false)
  })

  /* Tyhja nimike ei ole peruste hylata: moni aito merkinta on ilman. */
  it("tyhja nimike ei ole hylkayssyy", () => {
    expect(eiTyomaaRooli(null)).toBe(false)
    expect(eiTyomaaRooli("")).toBe(false)
    expect(eiTyomaaRooli("   ")).toBe(false)
  })

  /*
   * "Multimedia" ei ole viestintarooli, ja "Myyränkatu" ei ole myyntia
   * -- kuvio ei saa osua sanan sisalle miten sattuu.
   */
  it("ei osu vaarin sanan sisalle", () => {
    expect(eiTyomaaRooli("Projektipäällikkö, Myyrmäen hanke")).toBe(false)
  })
})

describe("hankesana kumoaa karsinnan", () => {
  /* Puoliksi myyntia, puoliksi hankekehitysta -> hankkeen puolella. */
  it("ei karsi kun nimikkeessa on hankesana", () => {
    expect(eiTyomaaRooli("Myynti- ja hankekehityspäällikkö")).toBe(false)
    expect(eiTyomaaRooli("myyntipäällikkö, projektikehitys")).toBe(false)
  })

  /* Omistajan asiakaspaallikko on aito vastinpari, ei myyja. */
  it("ei karsi asiakaspaallikkoa", () => {
    expect(eiTyomaaRooli("Asiakaspäällikkö")).toBe(false)
  })

  /* Mutta pelkka myyntirooli karsiutuu yha. */
  it("karsii yha pelkan myyntiroolin", () => {
    expect(eiTyomaaRooli("myyntipäällikkö, LKV, LVV (Tampere)")).toBe(true)
    expect(eiTyomaaRooli("asuntomyyjä, YKV, LKV")).toBe(true)
  })
})
