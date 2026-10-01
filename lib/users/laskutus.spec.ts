import { describe, expect, it } from "vitest"

import { asiakkaanTunniste, normalisoiYritys, onVapaaSahkoposti } from "./asiakastunniste"
import { TESTIASIAKKAAN_HINTA, laskeLaskutus, muotoileEuro } from "./laskutus"

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

  /*
   * Trial on asiakas mutta ei maksaja. "Asiakkaita yhteensa" on
   * kokonaismaara, koska kortin sana lupaa sen - trialeilla on oma
   * lukunsa.
   */
  it("laskee trialin asiakkaaksi muttei maksajaksi", () => {
    const kayttajat = [
      ...Array.from({ length: 13 }, (_, i) => ({ email: `k${i}@koneunion.fi` })),
      { email: "maksaja@asiakas.fi" },
    ]
    const y = laskeLaskutus(kayttajat, [
      { tunniste: "koneunion.fi", tila: "testi", kuukausihinta_eur: null },
      { tunniste: "asiakas.fi", tila: "maksava", kuukausihinta_eur: 250 },
    ])

    expect(y.testitunnuksia).toBe(13)
    expect(y.testiasiakkaita).toBe(1)
    expect(y.asiakkaitaYhteensa).toBe(2)
    expect(y.maksaviaAsiakkaita).toBe(1)
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

describe("asiakkaanTunniste valitulla yrityksella", () => {
  /*
   * Juuri tata varten yritys valitaan: kaksi gmail-kayttajaa samasta
   * yrityksesta ovat yksi asiakas, mita sahkopostista ei voi paatella.
   */
  it("yhdistaa vapaan sahkopostin kayttajat samaan yritykseen", () => {
    expect(asiakkaanTunniste("eka@gmail.com", "Rakennus Oy")).toBe("rakennus oy")
    expect(asiakkaanTunniste("toka@hotmail.com", "Rakennus Oy")).toBe("rakennus oy")
  })

  it("valinta voittaa myos yritysdomainin", () => {
    expect(asiakkaanTunniste("a@asiakasyritys.fi", "Konserni Oy")).toBe("konserni oy")
  })

  it("palaa paattelyyn kun yritysta ei ole valittu", () => {
    expect(asiakkaanTunniste("a@asiakasyritys.fi", null)).toBe("asiakasyritys.fi")
    expect(asiakkaanTunniste("a@asiakasyritys.fi", "   ")).toBe("asiakasyritys.fi")
  })

  /* Kirjoitusasun vaihtelu ei saa synnyttaa kahta asiakasta. */
  it("normalisoi kirjainkoon ja valilyonnit", () => {
    expect(normalisoiYritys("  Koneunion   Oy ")).toBe("koneunion oy")
    expect(asiakkaanTunniste("a@gmail.com", "KONEUNION OY")).toBe(
      asiakkaanTunniste("b@gmail.com", "  koneunion  oy  ")
    )
  })
})

describe("potentiaalinen MRR ja ARR", () => {
  /*
   * Testiasiakas on ASIAKAS, ei tunnus: Koneunionin 13 tunnusta ovat
   * yksi 149 euron potentiaali, eivat kolmetoista.
   */
  it("laskee testiasiakkaan kerran vaikka tunnuksia on 13", () => {
    const kayttajat = Array.from({ length: 13 }, (_, i) => ({ email: `k${i}@testiyritys.fi` }))
    const y = laskeLaskutus(kayttajat, [
      { tunniste: "testiyritys.fi", tila: "testi", kuukausihinta_eur: null },
    ])

    expect(y.testiasiakkaita).toBe(1)
    expect(y.testitunnuksia).toBe(13)
    expect(y.potentiaalinenMrr).toBe(TESTIASIAKKAAN_HINTA)
    expect(y.potentiaalinenArr).toBe(TESTIASIAKKAAN_HINTA * 12)
  })

  /* Potentiaali sisaltaa nykyisen MRR:n, ei ole siita erillinen. */
  it("summaa nykyisen MRR:n ja testiasiakkaat", () => {
    const y = laskeLaskutus(
      [{ email: "a@maksava.fi" }, { email: "b@testi1.fi" }, { email: "c@testi2.fi" }],
      [
        { tunniste: "maksava.fi", tila: "maksava", kuukausihinta_eur: 300 },
        { tunniste: "testi1.fi", tila: "testi", kuukausihinta_eur: null },
        { tunniste: "testi2.fi", tila: "testi", kuukausihinta_eur: null },
      ]
    )

    expect(y.mrr).toBe(300)
    expect(y.testiasiakkaita).toBe(2)
    expect(y.potentiaalinenMrr).toBe(300 + 2 * TESTIASIAKKAAN_HINTA)
    expect(y.potentiaalinenArr).toBe((300 + 2 * TESTIASIAKKAAN_HINTA) * 12)
  })

  /* Hinnat ovat yrityskohtaisia, joten tiedetty hinta voittaa oletuksen. */
  it("kayttaa trialille kirjattua hintaa oletuksen sijaan", () => {
    const y = laskeLaskutus(
      [{ email: "a@sarlin-esimerkki.fi" }, { email: "b@toinen-esimerkki.fi" }],
      [
        { tunniste: "sarlin-esimerkki.fi", tila: "testi", kuukausihinta_eur: 99 },
        { tunniste: "toinen-esimerkki.fi", tila: "testi", kuukausihinta_eur: null },
      ]
    )

    expect(y.potentiaalinenMrr).toBe(99 + TESTIASIAKKAAN_HINTA)
    expect(y.mrr).toBe(0)
  })

  it("on sama kuin MRR kun testiasiakkaita ei ole", () => {
    const y = laskeLaskutus(
      [{ email: "a@maksava.fi" }],
      [{ tunniste: "maksava.fi", tila: "maksava", kuukausihinta_eur: 199 }]
    )
    expect(y.potentiaalinenMrr).toBe(199)
    expect(y.potentiaalinenArr).toBe(199 * 12)
  })

  /* Valittu yritys ohjaa myos summaa: kaksi gmailia = yksi asiakas. */
  it("laskee valitun yrityksen yhtena asiakkaana", () => {
    const y = laskeLaskutus(
      [
        { email: "eka@gmail.com", yritys: "Rakennus Oy" },
        { email: "toka@hotmail.com", yritys: "Rakennus Oy" },
      ],
      [{ tunniste: "rakennus oy", tila: "maksava", kuukausihinta_eur: 250 }]
    )

    expect(y.maksaviaAsiakkaita).toBe(1)
    expect(y.maksaviaTunnuksia).toBe(2)
    expect(y.mrr).toBe(250)
  })
})
