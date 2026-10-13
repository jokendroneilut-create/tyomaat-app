import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { lapaiseeSuodatuksen, TORPPARI } from "./fetchTorppariSource"
import {
  jasennaRss,
  kortinAla,
  lueTietokortti,
  sivuurakoitsijanEhdokas,
  sivuurakoitsijanVaihe,
  tekstiksi,
} from "./sivuurakoitsijaRss"

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

  it("merkitsee valmistuneeksi kun ingressi sanoo hankkeen valmistuneen", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Hyrylän Särmä avautuu – Torppari mukana rakentamassa Tuusulan uutta keskustaa",
        "Hyrylän uusi liike- ja palvelukeskus Särmä avaa ovensa käyttäjilleen. Heinäkuussa 2024 käynnistynyt rakennushanke valmistui elokuussa 2026. Torpparin urakkaan kuuluivat perustukset."
      )
    ).toBe("Valmistunut")
  })

  it("ei lue myohemman virkkeen aiempaa valmistunutta kohdetta", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Torppari toteuttaa runkorakenteet koulu- ja päiväkotihankkeessa",
        "Torppari Yhtiöt Oy vastaa hankkeessa muottitöistä. Työt ovat parhaillaan käynnissä. Edellinen yhteinen kohde valmistui vuonna 2024."
      )
    ).not.toBe("Valmistunut")
  })

  it("ei pida tulevaa avautumista valmistuneena", () => {
    expect(
      sivuurakoitsijanVaihe(
        "Uusi väylä avautuu liikenteelle 2027 – Torppari rakentaa siltaa",
        "Torppari toteuttaa parhaillaan risteyssiltaa. Väylän on määrä avautua liikenteelle vuoden 2027 loppupuolella."
      )
    ).not.toBe("Valmistunut")
  })
})

describe("tekstiksi", () => {
  it("purkaa kahdesti koodatun HTML:n ennen tagien poistoa", () => {
    expect(tekstiksi("&amp;lt;p&amp;gt;Silta&amp;lt;/p&amp;gt;")).toBe("Silta")
  })
})

/*
 * Johannes 13.10.2026: Danfoss-ehdokkaalta puuttuivat tilaaja,
 * paaurakoitsija, osoite ja ala, vaikka jutun lopun tietokortti nimeaa
 * ne. Tekstit ovat Torpparin oikeita julkaisuja, lyhennettyina.
 */
const TAYTE = "Torppari vastaa hankkeen muotti- ja betonointitöistä. ".repeat(16)

const DANFOSS = {
  otsikko:
    "Yhteistyö uuden sukupolven rakennusliikkeen kanssa – Torppari mukana rakentamassa Danfoss Editronin tehdasta Lappeenrantaan",
  osoite: "https://www.torppariyhtiot.fi/ajankohtaista/danfoss",
  teksti:
    "Lappeenrannan lentokentän läheisyyteen rakentuu parhaillaan yksi Etelä-Karjalan merkittävimmistä teollisuusinvestoinneista: Danfoss Editronin uusi tuotanto- ja tuotekehityskeskus. " +
    TAYTE +
    "LATO konserniin kuuluva Lappeenrannan Yritystila Oy rakennuttaa Danfoss Editronille uudet tilat 18,6 miljoonalla eurolla. Pääurakoitsijana toimii Raspal Oy. " +
    "Danfoss tehdas- ja toimistotilat Tilaaja: Lappeenrannan Yritystila Oy Pääurakoitsija: Raspal Oy Bruttopinta-ala: n. 8200 m² Sijainti: Lentokentäntie 28, 53600 Lappeenranta Aikataulu: Valmistuu loppuvuodesta 2026 https://www.danfoss.com/fi-fi/",
  pvm: new Date("2025-11-16"),
}

describe("tietokortti", () => {
  it("lukee kortin kentat seuraavaan nimikkeeseen asti", () => {
    expect(lueTietokortti(DANFOSS.teksti)).toEqual({
      Tilaaja: "Lappeenrannan Yritystila Oy",
      "Pääurakoitsija": "Raspal Oy",
      "Bruttopinta-ala": "n. 8200 m²",
      Sijainti: "Lentokentäntie 28, 53600 Lappeenranta",
      Aikataulu: "Valmistuu loppuvuodesta 2026",
    })
  })

  it("ei pida yksittaista nimiketta korttina", () => {
    expect(lueTietokortti("Kohteen tiedot. Tilaaja: Senaatti-kiinteistöt.")).toBeNull()
  })

  it("lukee alan neliomerkista", () => {
    expect(kortinAla("n. 8200 m²")).toBe(8200)
    expect(kortinAla("noin 9 650 brm²")).toBe(9650)
    expect(kortinAla("kolme kerrosta")).toBeNull()
  })

  it("kortti antaa ehdokkaalle osapuolet, osoitteen ja alan", () => {
    const e = sivuurakoitsijanEhdokas(DANFOSS, TORPPARI)
    expect(e.developer).toBe("Lappeenrannan Yritystila Oy")
    expect(e.builder).toBe("Raspal Oy")
    expect(e.location).toBe("Lentokentäntie 28, 53600 Lappeenranta")
    expect(e.metadata.floor_area).toBe(8200)
  })
})

describe("osapuolet ingressin ulkopuolelta", () => {
  it("lukee jutun lopussa nimetyn paaurakoitsijan (Hangonsilta)", () => {
    const e = sivuurakoitsijanEhdokas(
      {
        otsikko:
          "Torppari toteuttaa runkorakenteet Hyvinkään Hangonsillan koulu- ja päiväkotihankkeessa",
        osoite: "https://www.torppariyhtiot.fi/ajankohtaista/hangonsilta",
        teksti:
          "Hangonsillan koulu ja päiväkoti Hyvinkäälle. Kesällä 2025 käynnistynyt Hangonsillan koulu ja päiväkoti Vilinä -hanke on merkittävä lisä Hyvinkään kouluverkostoon. " +
          TAYTE +
          "Hankkeen pääurakoitsijana toimii Lujatalo Oy. Juha Kolhinoja, Torppari Yhtiöt Oy",
        pvm: new Date("2025-10-17"),
      },
      TORPPARI
    )
    expect(e.builder).toBe("Lujatalo Oy")
    expect(e.phase).toBe("Rakenteilla")
  })

  it("lukee kaupungin tilaajaksi (Makasiinilaituri)", () => {
    const e = sivuurakoitsijanEhdokas(
      {
        otsikko: "Uutta rantaviivaa betonista – Torppari mukana uudistamassa Helsingin Makasiinilaituria",
        osoite: "https://www.torppariyhtiot.fi/ajankohtaista/makasiini",
        teksti:
          "Helsingin Eteläsatamassa on parhaillaan käynnissä merkittävä infrarakennushanke. Hankkeen pääurakoitsijana toimii GRK Suomi Oy, ja tilaajana Helsingin kaupunki.",
        pvm: new Date("2026-08-07"),
      },
      TORPPARI
    )
    expect(e.developer).toBe("Helsingin kaupunki")
    expect(e.builder).toBe("GRK Suomi Oy")
  })

  it("ei lue aiemman kohteen paaurakoitsijaa menneesta muodosta (GRK-haastattelu)", () => {
    const e = sivuurakoitsijanEhdokas(
      {
        otsikko: "Kun sopimus pitää – GRK ja Torppari betonoivat yhteistyönsä Karjalan radalla",
        osoite: "https://www.torppariyhtiot.fi/ajankohtaista/grk",
        teksti:
          "GRK:n työpäällikkö on rakentanut siltoja lähes neljän vuosikymmenen ajan. " +
          TAYTE +
          "Yhteensä 3,4 miljoonan euron hankkeessa Torppari vastasi betonirakenteista, pääurakoitsijana oli GRK Suomi Oy.",
        pvm: new Date("2026-06-26"),
      },
      TORPPARI
    )
    expect(e.builder).toBeNull()
  })
})
