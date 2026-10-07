import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { lapaiseeSuodatuksen, TORPPARI } from "./fetchTorppariSource"
import { jasennaRss, sivuurakoitsijanEhdokas, sivuurakoitsijanVaihe, tekstiksi } from "./sivuurakoitsijaRss"

/*
 * Naytteet ovat Torpparin oikeita julkaisuja 8.10.2026 (D-250), eivat
 * keksittyja. Syote on tallennettu lyhennettyna:
 * `__fixtures__/sivuurakoitsijat/torppari.rss.xml`.
 */
const XML = readFileSync(
  join(__dirname, "__fixtures__", "sivuurakoitsijat", "torppari.rss.xml"),
  "utf8"
)

describe("Torpparin suodatin", () => {
  /* Kaikki kuusi viimeisen 12 kk julkaisua ovat hankkeita. */
  const lapaisee = [
    "Torppari mukana Mt 180 Kurkela–Kuusisto -hankkeen siltarakentamisessa",
    "Hyrylän Särmä avautuu – Torppari mukana rakentamassa Tuusulan uutta keskustaa",
    "Uutta rantaviivaa betonista – Torppari mukana uudistamassa Helsingin Makasiinilaituria",
    "Kun sopimus pitää ja asiat hoituvat ilman vääntämistä – GRK ja Torppari betonoivat yhteistyönsä Karjalan radalla",
    "Yhteistyö uuden sukupolven rakennusliikkeen kanssa – Torppari mukana rakentamassa Danfoss Editronin tehdasta Lappeenrantaan",
    "Torppari toteuttaa runkorakenteet Hyvinkään Hangonsillan koulu- ja päiväkotihankkeessa",
    "Torppari mukana toteuttamassa Karjalanradan siltahankkeita",
  ]
  for (const otsikko of lapaisee) {
    it(`paastaa lapi: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(true)
    })
  }

  /* Syotteen yhdeksan henkilo- ja yritysjuttua. */
  const hylataan = [
    "Tulevaisuuden työnjohtaja",
    "Maailma muuttuu Eskoseni",
    "Aloittamisen vaikeudesta",
    "Torpparin suorituskyky parantui entisestään haastavien aikojen keskellä",
    "Tuulen Nopeudella",
    "Rakentamisen monitaituri, Miika Piipponen",
    "Kuva olis kiva — niin kuin vanhassa kirjeenvaihto-ilmoituksessa",
    "Henkilöstökehityksen uusi taso",
    "Yksinkertainen Maalaispoika, Tuomas Rautio",
  ]
  for (const otsikko of hylataan) {
    it(`hylkaa: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(false)
    })
  }
})

describe("jasennaRss (Squarespace)", () => {
  const julkaisut = jasennaRss(XML)

  it("lukee molemmat julkaisut", () => {
    expect(julkaisut).toHaveLength(2)
  })

  it("purkaa heksaentiteetin otsikossa ajatusviivaksi", () => {
    expect(julkaisut[1].otsikko).toBe(
      "Kuva olis kiva — niin kuin vanhassa kirjeenvaihto-ilmoituksessa"
    )
  })

  it("ottaa koko tekstin content:encodedista eika pelkkaa ingressia", () => {
    expect(julkaisut[0].teksti).toMatch(/^Torppari toteuttaa parhaillaan Kaarinassa/)
    expect(julkaisut[0].teksti).toMatch(/Varsinainen rakentaminen käynnistyi/)
    expect(julkaisut[0].teksti).not.toMatch(/<p|data-rte/)
  })

  it("lukee julkaisupaivan", () => {
    expect(julkaisut[0].pvm?.toISOString().slice(0, 10)).toBe("2026-10-06")
  })
})

describe("sivuurakoitsijanEhdokas", () => {
  const kurkela = sivuurakoitsijanEhdokas(jasennaRss(XML)[0], TORPPARI)

  /*
   * JULKAISIJA EI OLE PAAURAKOITSIJA. Tekstin nimeama paaurakoitsija ja
   * tilaaja kirjataan; Torppari menee liittyviin yrityksiin.
   */
  it("kirjaa tekstin paaurakoitsijan ja tilaajan, ei julkaisijaa", () => {
    expect(kurkela.builder).toBe("Kreate Oy")
    expect(kurkela.developer).toBe("Väylävirasto")
    expect(kurkela.metadata.related_companies).toEqual(["Torppari Yhtiöt"])
  })

  it("tunnistaa kaupungin ja rakentamisvaiheen", () => {
    expect(kurkela.city).toBe("Kaarina")
    expect(kurkela.phase).toBe("Rakenteilla")
    expect(kurkela.completed).toBe(false)
  })
})

describe("sivuurakoitsijanVaihe", () => {
  it("'toteuttaa' otsikossa on vahintaan sopimus", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Torppari toteuttaa runkorakenteet Hyvinkään Hangonsillan koulu- ja päiväkotihankkeessa",
        "Torppari Yhtiöt Oy vastaa hankkeessa muotti-, elementtiasennus-, raudoitus- ja betonointitöistä."
      )
    ).toBe("Sopimus myönnetty")
  })

  /* JavaScriptin \b on ASCII-pohjainen: "kaynnissa\b" ei osuisi koskaan. */
  it("tunnistaa 'on parhaillaan kaynnissa' a-kirjaimesta huolimatta", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Uutta rantaviivaa betonista",
        "Helsingin Eteläsatamassa on parhaillaan käynnissä merkittävä infrarakennushanke."
      )
    ).toBe("Rakenteilla")
  })

  /* Piilotettu kesken oleva hanke on pahempi kuin valmistunut listalla. */
  it("ei pida 'avautuu'-otsikkoa valmistuneena", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Hyrylän Särmä avautuu – Torppari mukana rakentamassa Tuusulan uutta keskustaa",
        "Hyrylän uusi liike- ja palvelukeskus Särmä avaa ovensa käyttäjilleen."
      )
    ).not.toBe("Valmistunut")
  })
})

describe("tekstiksi", () => {
  it("purkaa kahdesti koodatun HTML:n ennen tagien poistoa", () => {
    expect(tekstiksi("&amp;lt;p&amp;gt;Silta&amp;lt;/p&amp;gt;")).toBe("Silta")
  })
})
