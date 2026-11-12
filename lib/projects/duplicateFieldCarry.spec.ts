import { describe, expect, it } from "vitest"

import { onTyhja, siirrettavatArvot } from "./duplicateFieldCarry"

describe("onTyhja", () => {
  it("pitaa viivaa tyhjana", () => {
    /* Kannassa on sekä null etta "-"; kumpikaan ei ole tietoa. */
    expect(onTyhja("-")).toBe(true)
    expect(onTyhja("  ")).toBe(true)
    expect(onTyhja(null)).toBe(true)
    expect(onTyhja(undefined)).toBe(true)
  })

  it("ei pida nollaa tyhjana", () => {
    /* 0 asuntoa on tieto, ei puute. */
    expect(onTyhja(0)).toBe(false)
    expect(onTyhja("Skanska")).toBe(false)
  })
})

describe("siirrettavatArvot", () => {
  it("tayttaa tyhjan kentan piilotetulta", () => {
    const tulos = siirrettavatArvot(
      { developer: null, lat: null, lng: null },
      { developer: "ABO Energy Suomi Oy", lat: 60.1, lng: 24.9 }
    )
    expect(tulos).toEqual({ developer: "ABO Energy Suomi Oy", lat: 60.1, lng: 24.9 })
  })

  /*
   * Olemassa olevaa arvoa ei korvata: se voi olla ihmisen kasin
   * korjaama, eika lahteesta puuttuva tarkoita etta kasin annettu
   * olisi vaarin.
   */
  it("ei korvaa olemassa olevaa arvoa", () => {
    const tulos = siirrettavatArvot(
      { developer: "Turun kaupunki" },
      { developer: "Turun Raitiotie Oy ja Turun kaupunki" }
    )
    expect(tulos).toEqual({})
  })

  /*
   * Mitattu kuivaharjoituksessa: osapuolten yhdistaminen olisi
   * tuottanut "Skanska Oy, Skanska". Siksi vain tyhja taytetaan.
   */
  it("ei yhdista osapuolinimia", () => {
    expect(siirrettavatArvot({ builder: "Skanska Oy" }, { builder: "Skanska" })).toEqual({})
  })

  it("ohittaa roska-arvon", () => {
    expect(siirrettavatArvot({ developer: null }, { developer: "Muu" })).toEqual({})
    expect(siirrettavatArvot({ developer: null }, { developer: "Ei tiedossa" })).toEqual({})
  })

  /*
   * MENNYT PAIVA PIILOTTAISI HANKKEEN. `autoCompleteGate` siirtaa
   * hankkeen 90 vrk:n jalkeen Valmistuneeksi ja pois asiakkaan
   * nakymasta (D-298), joten "lisaa tietoa" muuttuisi piilotukseksi.
   */
  it("ei siirra mennytta valmistumispaivaa", () => {
    const tulos = siirrettavatArvot(
      { estimated_completion: null },
      { estimated_completion: "2020-12-31" },
      "2026-10-18"
    )
    expect(tulos).toEqual({})
  })

  it("siirtaa tulevan valmistumispaivan", () => {
    const tulos = siirrettavatArvot(
      { estimated_completion: null },
      { estimated_completion: "2027-12-31" },
      "2026-10-18"
    )
    expect(tulos).toEqual({ estimated_completion: "2027-12-31" })
  })

  it("kestaa puuttuvan rivin", () => {
    expect(siirrettavatArvot(null, { developer: "X" })).toEqual({})
    expect(siirrettavatArvot({ developer: null }, null)).toEqual({})
  })

  /* Kenttia joita ei ole listassa ei siirreta, vaikka ne olisivat tyhjia. */
  it("ei koske listan ulkopuolisiin kenttiin", () => {
    const tulos = siirrettavatArvot(
      { developer: null, name: null, is_public: null },
      { developer: "X", name: "Toinen nimi", is_public: false }
    )
    expect(tulos).toEqual({ developer: "X" })
  })
})

describe("kustannus ratkaistaan alkuperan mukaan (D-407)", () => {
  const sopimus = (n: number) => ({ estimated_cost: n, metadata: { cost_source: "contract" } })
  const arvio = (n: number) => ({ estimated_cost: n, metadata: { cost_source: "notice" } })

  it("piilotettavan sopimushinta voittaa sailyjan ennakkoarvion", () => {
    /* Sigurd Frosteruksen puisto: Hilman arvio 5,1 M, urakkasumma 3,81 M. */
    expect(siirrettavatArvot(arvio(5100000), sopimus(3811040))).toEqual({
      estimated_cost: 3811040,
    })
  })

  it("ennakkoarvio EI korvaa sailyjan sopimushintaa", () => {
    expect(siirrettavatArvot(sopimus(3811040), arvio(5100000))).toEqual({})
  })

  it("sama alkupera: sailyjan arvo jaa", () => {
    expect(siirrettavatArvot(sopimus(100), sopimus(200))).toEqual({})
  })

  it("tyhja sailyjan kentta taytetaan alkuperasta riippumatta", () => {
    expect(siirrettavatArvot({ estimated_cost: null }, arvio(5100000))).toEqual({
      estimated_cost: 5100000,
    })
  })

  it("merkitsematon alkupera on heikoin, joten sopimushinta voittaa sen", () => {
    expect(siirrettavatArvot({ estimated_cost: 999 }, sopimus(123))).toEqual({
      estimated_cost: 123,
    })
  })
})
