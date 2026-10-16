import { describe, expect, it } from "vitest"

import {
  IKKUNA_PAIVAA,
  jasennaLista,
  jasennaTiedote,
  onHanketiedote,
  onTuore,
} from "./fetchDestiaSource"

/* Vastaa destia.fi/wp-json/destia/posts -vastausta 17.10.2026. */
const VASTAUS = {
  foundPosts: 391,
  posts: [
    {
      id: 14736,
      title: "Destia toimii BoP-urakoitsijana 125 MW / 250 MWh:n BESS-projektissa Vuolijoella",
      date: "14.10.2026",
      dateIntl: "2026-10-14",
      link: "https://destia.fi/tiedote/destia-toimii-bop-urakoitsijana-125-mw-250-mwhn-bess-projektissa-vuolijoella/",
      postType: "release",
    },
    {
      id: 14680,
      title: "Tieverkon jatkuva rapautuminen uhkaa investointeja",
      date: "30.9.2026",
      dateIntl: "2026-09-30",
      link: "https://destia.fi/tiedote/tieverkon-jatkuva-rapautuminen/",
      postType: "release",
    },
  ],
}

describe("jasennaLista", () => {
  it("lukee otsikon, osoitteen ja paivan", () => {
    const rivit = jasennaLista(VASTAUS)
    expect(rivit).toHaveLength(2)
    expect(rivit[0].otsikko).toMatch(/BESS-projektissa Vuolijoella/)
    expect(rivit[0].paiva).toBe("2026-10-14")
    expect(rivit[0].url).toMatch(/^https:\/\/destia\.fi\/tiedote\//)
  })

  it("ei kaadu kun vastaus on tyhja tai vaarassa muodossa", () => {
    /*
     * Rajapinta vastaa HTTP 200 ja `foundPosts: 0` kun runko on vaarin -
     * esimerkiksi jos `postTypes` kirjoitetaan yksikossa. Silloin
     * tulos on tyhja lista, ei poikkeus.
     */
    expect(jasennaLista({ foundPosts: 0, posts: [] })).toEqual([])
    expect(jasennaLista({})).toEqual([])
    expect(jasennaLista(null)).toEqual([])
    expect(jasennaLista({ posts: "ei lista" })).toEqual([])
  })

  it("hylkaa rivin jolta puuttuu osoite tai paiva", () => {
    const rivit = jasennaLista({
      posts: [
        { title: "Ilman osoitetta", dateIntl: "2026-10-14", link: "" },
        { title: "Ilman paivaa", dateIntl: "", link: "https://destia.fi/tiedote/x/" },
        { title: "", dateIntl: "2026-10-14", link: "https://destia.fi/tiedote/y/" },
      ],
    })
    expect(rivit).toEqual([])
  })
})

describe("onTuore", () => {
  const NYT = new Date("2026-10-17T00:00:00Z")

  it("hyvaksyy 12 kuukauden sisalta", () => {
    expect(onTuore("2026-10-14", NYT)).toBe(true)
    expect(onTuore("2025-11-01", NYT)).toBe(true)
  })

  it("hylkaa vanhemman", () => {
    /*
     * Arkistossa on 391 tiedotetta vuodesta 2018. Vanha urakkavoitto ei
     * ole mahdollisuus vaan historiaa.
     */
    expect(onTuore("2024-07-31", NYT)).toBe(false)
    expect(onTuore("2018-01-01", NYT)).toBe(false)
  })

  it("sietaa kelvottoman paivan", () => {
    expect(onTuore("", NYT)).toBe(false)
    expect(onTuore("ei paiva", NYT)).toBe(false)
  })

  it("ikkuna on 12 kuukautta", () => {
    expect(IKKUNA_PAIVAA).toBe(365)
  })
})

describe("onHanketiedote", () => {
  /*
   * MITATTU KUIVAHARJOITUKSESSA 17.10.2026: pelkka musta lista paasti
   * lapi 8 / 16 ei-hanketta. Siksi vaaditaan MYOS positiivinen
   * urakkasignaali.
   */
  it("hyvaksyy urakkatiedotteet", () => {
    for (const otsikko of [
      "Destia toimii BoP-urakoitsijana 125 MW / 250 MWh:n BESS-projektissa Vuolijoella",
      "Länsiratikat-hanke on käynnistynyt Helsingissä",
      "Destialle 200 miljoonan sopimus Vantaan ratikan toisesta osuudesta",
      "Destia peruskorjaa kahdeksan siltaa Uudellamaalla",
      "Destia rakentaa Vantaan Energia Sähköverkoille uuden sähköaseman",
      "Destia parantaa valtatietä 15 Rantahaan ja Kouvolan välillä",
      "Vantaan ratikan toteutussopimus allekirjoitettu",
      "Destia toteuttaa kolme keskeistä sähköasemaurakkaa Fingridille",
    ]) {
      expect(onHanketiedote(otsikko), otsikko).toBe(true)
    }
  })

  it("hylkaa yritysviestinnan", () => {
    for (const otsikko of [
      "Destialla lähes 300 kesäharjoittelijaa",
      "Ahlström Collective Impact lisää tukeaan UNICEFille",
      "Destia ja Vastuu Group tiivistävät yhteistyötään",
      "Tieverkon jatkuva rapautuminen uhkaa investointeja",
      "Destia kasvoi ennätyksellisesti ja vahvisti vastuullista infrarakentamista",
      "Destialle tuplavoitto Eezyn Innostavimmat työpaikat 2025 -tutkimuksessa",
      "Destia vahvistaa työturvallisuuden johtamista",
      "Destia avaa infra-alan asiantuntijapalveluiden verkkokaupan",
      "Suomen raskaan liikenteen kokonaiskuva ja tulevaisuus",
      "Yritykset kaipaavat poliitikoilta käytännön toimia",
    ]) {
      expect(onHanketiedote(otsikko), otsikko).toBe(false)
    }
  })

  /*
   * Rajatapaus joka opetti etta musta lista yksin ei riita: otsikossa on
   * sana "talonrakentamisen", mutta kyse on koulutusyhteistyosta.
   */
  it("hylkaa koulutusuutisen vaikka siina on rakentamissana", () => {
    expect(
      onHanketiedote("Destia ja Oulun ammattikorkeakoulu aloittavat talonrakentamisen koulutuksen")
    ).toBe(false)
  })

  it("hylkaa kunnossapitourakat", () => {
    /* Monivuotinen palvelusopimus ei ole tyomaa. */
    expect(onHanketiedote("Destia voitti seitsemän maanteiden hoitourakkaa")).toBe(false)
    expect(onHanketiedote("Destia on voittanut radan ja turvalaitteiden kunnossapitourakan")).toBe(false)
  })

  it("hylkaa tyhjan", () => {
    expect(onHanketiedote("")).toBe(false)
  })
})

describe("jasennaTiedote", () => {
  it("lukee artikkelin tekstin", () => {
    const html =
      "<html><body><nav>Palvelut Akkuenergiavarastot Aurinkovoimainfra</nav>" +
      "<article><h1>Destia rakentaa</h1><p>Urakka käsittää sähköaseman rakentamisen Vuolijoelle.</p></article>" +
      "</body></html>"
    const t = jasennaTiedote(html)
    expect(t).toMatch(/Urakka käsittää/)
  })

  it("ei ota paavalikon palvelulistaa mukaan", () => {
    /*
     * Koko body sisaltaisi valikon ("Akkuenergiavarastot
     * Aurinkovoimainfra Datakeskusten infrarakentaminen..."), joka
     * vuotaisi jokaiseen kuvaukseen.
     */
    const html =
      "<html><body><nav>Akkuenergiavarastot Aurinkovoimainfra Kalliorakentaminen</nav>" +
      "<article><p>Tiedotteen oma teksti tässä.</p></article></body></html>"
    const t = jasennaTiedote(html)
    expect(t).not.toMatch(/Akkuenergiavarastot/)
  })

  it("palauttaa tyhjan kun sivulla ei ole mitaan", () => {
    expect(jasennaTiedote("<html><body></body></html>")).toBe("")
  })
})
