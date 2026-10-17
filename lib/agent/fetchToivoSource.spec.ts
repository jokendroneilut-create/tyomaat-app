import { describe, it, expect } from "vitest"
import {
  IKKUNA_PAIVAA,
  jasennaLista,
  jasennaSisalto,
  onHanketiedote,
  onTuore,
  tyypinTeksti,
} from "./fetchToivoSource"

describe("jasennaLista", () => {
  /*
   * Tunniste on se joka erottaa hankkeen talousviestinnasta: omien
   * osakkeiden hankinta on SHARE_REPURCHASE, porssitiedote
   * STOCK_EXCHANGE_RELEASE. Kohina on siis tunnisteessa eika vaadi
   * sanastoa.
   */
  const vastaus = {
    props: {
      publications: [
        {
          _id: "47b5665e",
          publishedAt: "2026-10-15T11:00:00.000Z",
          title: "Toivo Group Oyj aloittaa Helsingin Oulunkylään noin 7,5 miljoonan euron omistusasuntohankkeen",
          tags: ["PRESS_RELEASE"],
          hasContent: true,
        },
        {
          _id: "0b71d9d9",
          publishedAt: "2026-09-28T10:00:00.000Z",
          title: "Toivo Group Oyj: Omien osakkeiden mitätöinti rekisteröity",
          tags: ["STOCK_EXCHANGE_RELEASE"],
          hasContent: true,
        },
        {
          _id: "abc",
          publishedAt: "2026-08-24T10:00:00.000Z",
          title: "Omien osakkeiden hankinta ajalla 17.8.2026 - 21.8.2026",
          tags: ["SHARE_REPURCHASE", "STOCK_EXCHANGE_RELEASE"],
          hasContent: true,
        },
      ],
    },
  }

  it("ottaa vain lehdistotiedotteet", () => {
    const rivit = jasennaLista(vastaus)
    expect(rivit).toHaveLength(1)
    expect(rivit[0].id).toBe("47b5665e")
    expect(rivit[0].paiva).toBe("2026-10-15")
  })

  /* Tyhja tai muuttunut runko ei saa kaataa ajoa. */
  it("palauttaa tyhjan kun rakenne ei tasmaa", () => {
    expect(jasennaLista({})).toEqual([])
    expect(jasennaLista({ props: {} })).toEqual([])
    expect(jasennaLista(null)).toEqual([])
  })

  it("pudottaa rivin jolta puuttuu tunniste tai paiva", () => {
    expect(
      jasennaLista({
        props: { publications: [{ title: "Hanke", tags: ["PRESS_RELEASE"] }] },
      })
    ).toEqual([])
  })
})

describe("onTuore", () => {
  const nyt = new Date("2026-10-17T00:00:00Z")

  it("hyvaksyy ikkunan sisalta", () => {
    expect(onTuore("2026-10-15", nyt)).toBe(true)
    expect(onTuore("2025-11-20", nyt)).toBe(true)
  })

  /*
   * Arkisto alkaa 19.5.2021. Vuoden 2021 hanke on historiaa, ei
   * mahdollisuus - sama 12 kk:n saänto kuin muilla yrityslahteilla.
   */
  it("hylkaa ikkunaa vanhemman", () => {
    expect(onTuore("2021-05-19", nyt)).toBe(false)
    expect(IKKUNA_PAIVAA).toBe(365)
  })

  it("hylkaa kelvottoman paivan", () => {
    expect(onTuore("", nyt)).toBe(false)
    expect(onTuore("ei-paiva", nyt)).toBe(false)
  })
})

describe("onHanketiedote", () => {
  /*
   * Mitattu 12 kuukauden 27 otsikosta: 23 on konkreettinen kohde,
   * kolme tulosjulkistuksen kutsuja ja yksi rekrytointiuutinen.
   */
  it("hyvaksyy konkreettiset kohteet", () => {
    for (const otsikko of [
      "Toivo Group Oyj aloittaa Helsingin Oulunkylään noin 7,5 miljoonan euron omistusasuntohankkeen",
      "Toivo Group Oyj on solminut 2,9 M € aluerakennuskohteen Espoon Kaitaalle",
      "Toivo Group Oyj on valittu toteuttamaan päiväkotihanke Yli-Iihin Oulun kaupungille",
      "Toivo on allekirjoittanut noin 17 miljoonan euron KVR-urakkasopimuksen kerrostalohankkeen toteuttamisesta",
      "Toivo Group Oyj rakentaa noin 15 miljoonan euron asuinkerrostalon Premicon rahastolle Helsingin Pakilaan",
    ]) {
      expect(onHanketiedote(otsikko), otsikko).toBe(true)
    }
  })

  it("hylkaa tulosjulkistuksen kutsun ja rekrytoinnin", () => {
    for (const otsikko of [
      "Kutsu Toivo Group Oyj:n vuoden 2026 tammi-kesäkuun liiketoimintakatsauksen julkistukseen",
      "Toivo Group Oyj rekrytoi useita uusia osaajia liiketoiminnan kasvun seurauksena",
      "Toivo Group Oyj:n puolivuosikatsaus 1.1.–30.6.2026",
    ]) {
      expect(onHanketiedote(otsikko), otsikko).toBe(false)
    }
  })

  /*
   * Poissulku voittaa signaalin. "Kutsu ... liiketoimintakatsauksen
   * julkistukseen" sisaltaa sanan "toteutta" vain satunnaisesti, mutta
   * katsauksen otsikossa voi olla myos "kaynnisti hankkeita" - silloin
   * signaali osuisi vaaraan juttuun.
   */
  it("poissulku voittaa hankesignaalin", () => {
    expect(
      onHanketiedote(
        "Toivo Group Oyj:n puolivuosikatsaus 1.1.–30.6.2026: Yhtiö käynnisti hankkeita huikeat 60 miljoonaa euroa Q2/2026"
      )
    ).toBe(false)
  })

  it("hylkaa tyhjan", () => {
    expect(onHanketiedote("")).toBe(false)
  })
})

describe("jasennaSisalto", () => {
  it("purkaa kappaleet ja entiteetit", () => {
    const html =
      "<p>Lehdistötiedote, 15.10.2026 kello 14:00</p>" +
      '<p><img src="kuva.png" alt="Kuva1.png" /></p>' +
      "<p>Toivo Group Oyj (&#8221;Toivo&#8221;) käynnistää noin 7,5 miljoonan euron rakennushankkeen.</p>" +
      "<p>Urho Myllymäki<br />Varatoimitusjohtaja</p>"

    const teksti = jasennaSisalto(html)
    expect(teksti).toContain("Lehdistötiedote, 15.10.2026 kello 14:00")
    expect(teksti).toContain('"Toivo"')
    expect(teksti).toContain("7,5 miljoonan euron rakennushankkeen.")
    expect(teksti).toContain("Urho Myllymäki Varatoimitusjohtaja")
    expect(teksti).not.toContain("<")
  })

  it("kestaa tyhjan", () => {
    expect(jasennaSisalto("")).toBe("")
  })
})

describe("tyypinTeksti", () => {
  /*
   * MITATTU TAPAUS 17.10.2026. "4,2M€ aluerakennushanke Espoon
   * Mankkaalle" sai tyypin Koulu, koska tiedotteessa luki "kahdeksan
   * laadukasta rivitalokotia hienolle paikalle Mankkaan palveluiden ja
   * koulujen välittömään läheisyyteen".
   */
  const lause =
    "Hankkeeseen rakennetaan kahdeksan laadukasta rivitalokotia hienolle paikalle " +
    "Mankkaan palveluiden ja koulujen välittömään läheisyyteen."

  it("katkaisee lauseen laheisyyssanasta", () => {
    const tulos = tyypinTeksti(lause)
    expect(tulos).toContain("rivitalokotia")
    expect(tulos).not.toContain("koulujen")
  })

  /*
   * Katkaisu, ei pudotus: ensimmainen versio pudotti koko lauseen, ja
   * silloin "rivitalokotia" katosi mukana - tyyppi muuttui vaarasta
   * tyhjaksi, mika ei ole korjaus vaan toinen tappio.
   */
  it("ei pudota koko lausetta", () => {
    expect(tyypinTeksti(lause).length).toBeGreaterThan(40)
  })

  it("jattaa muun tekstin ennalleen", () => {
    const teksti = "Kohteeseen tulee 19 asuntoa ja liiketila. Talo on A-energialuokan kerrostalo."
    expect(tyypinTeksti(teksti)).toBe(teksti)
  })

  it("kestaa tyhjan", () => {
    expect(tyypinTeksti("")).toBe("")
  })
})
