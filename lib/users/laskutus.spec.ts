import { describe, expect, it } from "vitest"

import { asiakkaanTunniste, onVapaaSahkoposti } from "./asiakastunniste"
import { laskeLaskutus, muotoileEuro } from "./laskutus"

describe("asiakkaanTunniste", () => {
  /*
   * Yritysdomain on asiakas. Kuvio on mitattu: suurimmalla asiakkaalla
   * on 12 tunnusta samassa domainissa, ja ne ovat yksi maksaja.
   * Osoitteet tassa ovat keksittyja - repo on julkinen.
   */
  it("kayttaa yritysdomainia tunnisteena", () => {
    expect(asiakkaanTunniste("kayttaja1@asiakasyritys.fi")).toBe("asiakasyritys.fi")
    expect(asiakkaanTunniste("Kayttaja2@AsiakasYritys.FI")).toBe("asiakasyritys.fi")
  })

  /*
   * Vapaa sahkoposti ei ole yritys. Ilman tata kaksi eri asiakasta
   * olisi sama "gmail.com" ja toisen hinta katoaisi toisen alle.
   */
  it("kayttaa koko osoitetta vapaassa sahkopostissa", () => {
    expect(asiakkaanTunniste("etunimi.sukunimi@gmail.com")).toBe("etunimi.sukunimi@gmail.com")
    expect(asiakkaanTunniste("toinen.nimi@hotmail.com")).toBe("toinen.nimi@hotmail.com")
    expect(onVapaaSahkoposti("etunimi.sukunimi@gmail.com")).toBe(true)
    expect(onVapaaSahkoposti("kayttaja@asiakasyritys.fi")).toBe(false)
  })

  it("sietaa puuttuvan osoitteen", () => {
    expect(asiakkaanTunniste(null)).toBe("")
    expect(asiakkaanTunniste("eiOleOsoite")).toBe("")
    expect(asiakkaanTunniste("")).toBe("")
  })
})

describe("laskeLaskutus", () => {
  /* Suurimman asiakkaan kaltainen tapaus: 12 tunnusta, yksi hinta. */
  it("laskee asiakkaan kerran vaikka tunnuksia on monta", () => {
    const kayttajat = Array.from({ length: 12 }, (_, i) => ({ email: `k${i}@asiakasyritys.fi` }))
    const y = laskeLaskutus(kayttajat, [
      { tunniste: "asiakasyritys.fi", tila: "maksava", kuukausihinta_eur: 490 },
    ])

    expect(y.mrr).toBe(490)
    expect(y.arr).toBe(5880)
    expect(y.maksaviaAsiakkaita).toBe(1)
    expect(y.maksaviaTunnuksia).toBe(12)
  })

  it("summaa eri hinnat ja laskee ARR:n kahdestatoista kuukaudesta", () => {
    const y = laskeLaskutus(
      [{ email: "a@yksi.fi" }, { email: "b@kaksi.fi" }, { email: "c@kolme.fi" }],
      [
        { tunniste: "yksi.fi", tila: "maksava", kuukausihinta_eur: 199 },
        { tunniste: "kaksi.fi", tila: "maksava", kuukausihinta_eur: "350.50" },
        { tunniste: "kolme.fi", tila: "ei_maksava", kuukausihinta_eur: null },
      ]
    )

    expect(y.mrr).toBe(549.5)
    expect(y.arr).toBe(6594)
    expect(y.maksaviaAsiakkaita).toBe(2)
    expect(y.asiakkaitaYhteensa).toBe(3)
  })

  /* Koneunionin 13 tunnusta eivat ole asiakkaita eivatka maksajia. */
  it("jattaa testiasiakkaan kokonaan pois", () => {
    const kayttajat = [
      ...Array.from({ length: 13 }, (_, i) => ({ email: `k${i}@koneunion.fi` })),
      { email: "maksaja@asiakas.fi" },
    ]
    const y = laskeLaskutus(kayttajat, [
      { tunniste: "koneunion.fi", tila: "testi", kuukausihinta_eur: null },
      { tunniste: "asiakas.fi", tila: "maksava", kuukausihinta_eur: 250 },
    ])

    expect(y.testitunnuksia).toBe(13)
    expect(y.asiakkaitaYhteensa).toBe(1)
    expect(y.mrr).toBe(250)
  })

  /* Myyja ja admin eivat ole asiakkaita, kuten sivun omassa summassa. */
  it("ohittaa myyjan ja adminin", () => {
    const y = laskeLaskutus(
      [
        { email: "myyja@firma.fi", role: "seller" },
        { email: "admin@firma.fi", role: "admin" },
        { email: "asiakas@firma2.fi" },
      ],
      [{ tunniste: "firma2.fi", tila: "maksava", kuukausihinta_eur: 100 }]
    )

    expect(y.asiakkaitaYhteensa).toBe(1)
    expect(y.mrr).toBe(100)
  })

  /*
   * Vajaa MRR ei saa nayttaa tasmalliselta: maksavaksi merkitty ilman
   * hintaa on kerrottava erikseen.
   */
  it("kertoo montako maksavaa on ilman hintaa", () => {
    const y = laskeLaskutus(
      [{ email: "a@yksi.fi" }, { email: "b@kaksi.fi" }],
      [
        { tunniste: "yksi.fi", tila: "maksava", kuukausihinta_eur: 199 },
        { tunniste: "kaksi.fi", tila: "maksava", kuukausihinta_eur: null },
      ]
    )

    expect(y.ilmanHintaa).toBe(1)
    expect(y.maksaviaAsiakkaita).toBe(2)
    expect(y.mrr).toBe(199)
  })

  it("palauttaa vanhimman paivityksen", () => {
    const y = laskeLaskutus(
      [{ email: "a@yksi.fi" }, { email: "b@kaksi.fi" }],
      [
        { tunniste: "yksi.fi", tila: "maksava", kuukausihinta_eur: 10, updated_at: "2026-09-01T00:00:00Z" },
        { tunniste: "kaksi.fi", tila: "maksava", kuukausihinta_eur: 20, updated_at: "2026-02-14T00:00:00Z" },
      ]
    )

    expect(y.vanhinPaivitys).toBe("2026-02-14T00:00:00Z")
  })

  it("sietaa tyhjan aineiston", () => {
    const y = laskeLaskutus([], [])
    expect(y).toMatchObject({ mrr: 0, arr: 0, maksaviaAsiakkaita: 0, vanhinPaivitys: null })
  })
})

describe("muotoileEuro", () => {
  it("muotoilee suomalaisittain ilman sentteja", () => {
    expect(muotoileEuro(1234).replace(/ /g, " ")).toContain("1 234")
  })
})
