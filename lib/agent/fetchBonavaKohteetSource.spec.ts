import { describe, expect, it } from "vitest"

import {
  bonavaOsoite,
  kaupunkiOsoitteesta,
  parseBonavaPage,
  taloyhtioNimesta,
  vaiheMyyntitilasta,
  valmistumispaiva,
} from "./fetchBonavaKohteetSource"

describe("vaiheMyyntitilasta", () => {
  it("lukee vaiheen Bonavan myyntitilasta", () => {
    expect(vaiheMyyntitilasta("Planned")).toBe("Suunnittelu")
    expect(vaiheMyyntitilasta("Presales")).toBe("Suunnittelu")
    expect(vaiheMyyntitilasta("ForSale")).toBe("Rakenteilla")
  })

  /* Muuttovalmis = rakentaminen ohi, ei hankeloyto. */
  it("ei anna vaihetta valmiille eika tuntemattomalle", () => {
    expect(vaiheMyyntitilasta("ReadyToMoveIn")).toBeNull()
    expect(vaiheMyyntitilasta("JotainMuuta")).toBeNull()
    expect(vaiheMyyntitilasta(null)).toBeNull()
  })
})

describe("valmistumispaiva", () => {
  it("lukee kuukauden nimen", () => {
    expect(valmistumispaiva("Lokakuu 2026")).toBe("2026-10-31")
    expect(valmistumispaiva("Helmikuu 2028")).toBe("2028-02-29")
  })

  /*
   * Vuodenaikaa ei tulkita kuukaudeksi: "Kesalla 2027" jaa vuoden
   * tarkkuuteen, koska kesa osuisi kolmeen kuukauteen ja arvaus
   * nayttaisi tarkalta tiedolta. Vuosi -> vuoden loppu, kuten muissakin
   * arvioissa.
   */
  it("jattaa vuodenajan vuoden tarkkuuteen", () => {
    expect(valmistumispaiva("Kesällä 2027")).toBe("2027-12-31")
    expect(valmistumispaiva("Arviolta loppuvuodesta 2027")).toBe("2027-12-31")
  })

  it("ei arvaa ilman vuotta", () => {
    expect(valmistumispaiva("Myöhemmin")).toBeNull()
    expect(valmistumispaiva(null)).toBeNull()
  })
})

describe("kaupunkiOsoitteesta", () => {
  it("lukee kaupungin osoitepolusta", () => {
    expect(kaupunkiOsoitteesta("https://www.bonava.fi/asunnot/espoo/tapiola/tuulikello/espoon-tuulikello-3")).toBe(
      "Espoo"
    )
  })

  it("palauttaa nullin vieraasta polusta", () => {
    expect(kaupunkiOsoitteesta("https://www.bonava.fi/tietoa-meista/media")).toBeNull()
  })
})

/*
 * TASMAHAKU, EI POIMINTASAANTO. Numero kuuluu nimeen: Tuulikello 2 ja 3
 * ovat eri taloyhtioita, ja poimintasaannon genetiivikatkaisu pudottaisi
 * numeron.
 */
describe("taloyhtioNimesta", () => {
  it("hyvaksyy vain tasmalleen loytyvan nimen", () => {
    const teksti = "Asunto Oy Espoon Tuulikello 3 tuo odotettuja uusia koteja Tapiolaan."
    expect(taloyhtioNimesta("Espoon Tuulikello 3", teksti)).toBe("Asunto Oy Espoon Tuulikello 3")
  })

  it("ei keksi nimea kun tekstissa ei ole yhtiomuotoa", () => {
    expect(taloyhtioNimesta("Helsingin Askel", "Helsingin Askel rakentuu Postipuistoon.")).toBeNull()
  })

  it("ei sekoita eri vaiheita keskenaan", () => {
    const teksti = "Asunto Oy Espoon Tuulikello 2 valmistui viime vuonna."
    expect(taloyhtioNimesta("Espoon Tuulikello 3", teksti)).toBeNull()
  })
})

const SIVU = `
<script>
  window.bonavaInfo.pageType = 'ProjectPage';
  window.bonavaInfo.salesStatus = 'ForSale';
  window.bonavaInfo.productName = 'Espoon Tuulikello 3';
</script>
<div class="hero-box-fact">
  <div class="hero-box-fact__title">Valmistuminen:</div>
  <div class="hero-box-fact__value">Lokakuu 2026</div>
</div>
<div class="sticky-nav__text__item">
  <a class="button-primitive" href="#mapandshowings">Tuuliniitty 9, 02100 Espoo</a>
</div>
<p class="showings__information__details--address">Myyntitoimisto 1, 02100 Espoo</p>
<p>Asunto Oy Espoon Tuulikello 3 tuo odotettuja uusia koteja aivan Tapiolan puistojen aareen.</p>
`

describe("parseBonavaPage", () => {
  it("lukee tilan ja valmistumisen omista kentistaan", () => {
    const k = parseBonavaPage(SIVU)
    expect(k?.nimi).toBe("Espoon Tuulikello 3")
    expect(k?.tila).toBe("ForSale")
    expect(k?.vaihe).toBe("Rakenteilla")
    expect(k?.valmistuu).toBe("2026-10-31")
    expect(k?.osoite).toBe("Tuuliniitty 9, 02100 Espoo")
  })

  /* Aluesivu ei ole hanke: 33 osoitteesta vain 13 oli ProjectPage. */
  it("ohittaa muut kuin kohdesivut", () => {
    expect(parseBonavaPage("<script>window.bonavaInfo.pageType = 'AreaPage';</script>")).toBeNull()
  })
})

/*
 * OSOITE YLÄPALKISTA, EI ESITTELYLAATIKOSTA. Mitattu 9.9.2026 kaikilta
 * 13 kohdesivulta: esittelyn osoite puuttui viideltä (kaikki
 * `Planned`-vaiheessa) ja oli kahdella myyntitoimiston osoite eli eri
 * paikassa kuin kohde.
 */
describe("bonavaOsoite", () => {
  const ylapalkki = `
    <div class="sticky-nav__text__item">
      <a href="#mapandshowings">Kustinpolku 15, 00240 Helsinki</a>
    </div>`

  it("lukee yläpalkin osoitteen", () => {
    expect(bonavaOsoite(ylapalkki)).toBe("Kustinpolku 15, 00240 Helsinki")
  })

  /* Väärä osoite on pahempi kuin puuttuva: myyjä ajaisi myyntitoimistoon. */
  it("ei ota esittelyn osoitetta kohteen osoitteeksi", () => {
    const html =
      ylapalkki +
      `<p class="showings__information__details--address">Itälahdenkatu 21 B, 00210 Helsinki</p>`

    expect(bonavaOsoite(html)).toBe("Kustinpolku 15, 00240 Helsinki")
  })

  it("putoaa JSON-lohkoon jos merkkaus puuttuu", () => {
    const html = `<div>"StickyNav":{"Title":null,"Content":{"Heading":"Turun Silmu","SubHeading":"Heikintasku 6, 20200 Turku"}}</div>`

    expect(bonavaOsoite(html)).toBe("Heikintasku 6, 20200 Turku")
  })

  it("purkaa ääkköset JSON-lohkosta", () => {
    const html =
      '<div>"StickyNav":{"Content":{"SubHeading":"It\\u00E4lahdenkatu 21, 00210 Helsinki"}}</div>'

    expect(bonavaOsoite(html)).toBe("Itälahdenkatu 21, 00210 Helsinki")
  })

  it("palauttaa nullin kun osoitetta ei ole", () => {
    expect(bonavaOsoite("<p>Kohde valmistuu 2027.</p>")).toBeNull()
  })
})
