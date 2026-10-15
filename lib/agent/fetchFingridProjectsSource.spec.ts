import { describe, expect, it } from "vitest"

import {
  hankeslugit,
  jasennaHankesivu,
  lueKentta,
  vaiheTilasta,
} from "./fetchFingridProjectsSource"

/* Katkelmat vastaavat fingrid.fi:n rakennetta 15.10.2026. */

const LISTAUS = `
<html><body>
  <a href="/kantaverkko/rakentaminen/">Rakentaminen</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/">Hankkeet</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/aurora-line/">Aurora Line</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/espoo-framnas/">Espoo-Framnäs</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/aurora-line/">Aurora Line uudelleen</a>
</body></html>`

const HANKESIVU = `
<html><body>
  <nav><a href="/kantaverkko/rakentaminen/hankkeet/toinen-hanke/">Toinen hanke</a></nav>
  <div class="content">
    <div class="sidebar">Aurora Line Anttila-Länsisalmi Espoo-Framnäs Harjulinja</div>
    <div class="content-text">
      <h1>Espoo-Framnäs</h1>
      <p>Hankkeen tiedot Hankkeen tyyppi: Voimajohto Hankkeen tila: Suunnittelu
      Sijainti: Espoo, Uusimaa Pituus: noin 12 km</p>
      <p>Fingrid rakentaa uuden 400 kilovoltin voimajohdon Espoon ja Framnäsin välille.</p>
    </div>
  </div>
</body></html>`

describe("hankeslugit", () => {
  it("poimii hankkeiden tunnukset listauksesta", () => {
    expect(hankeslugit(LISTAUS)).toEqual(["aurora-line", "espoo-framnas"])
  })

  it("ei ota listaussivua itseaan eika ylatason linkkeja", () => {
    const slugit = hankeslugit(LISTAUS)
    expect(slugit).not.toContain("hankkeet")
    expect(slugit).not.toContain("rakentaminen")
  })
})

describe("lueKentta", () => {
  const teksti =
    "Hankkeen tiedot Hankkeen tyyppi: Voimajohto Hankkeen tila: Hanke on valmistunut " +
    "Sijainti: Norrbotten, Lappi, Pohjois-Pohjanmaa Pituus: noin 380 km Fingrid ja Ruotsin..."

  it("lukee arvon seuraavaan kenttaan asti", () => {
    /*
     * Tama oli vika ensimmaisessa versiossa: lookahead-regex palautti
     * 51 tapauksessa 52:sta tyhjan, koska kenttien valissa ei ole
     * valimerkkia vaan pelkka valilyonti.
     */
    expect(lueKentta(teksti, "Hankkeen tyyppi")).toBe("Voimajohto")
    expect(lueKentta(teksti, "Hankkeen tila")).toBe("Hanke on valmistunut")
    expect(lueKentta(teksti, "Sijainti")).toBe("Norrbotten, Lappi, Pohjois-Pohjanmaa")
  })

  it("palauttaa null kun kenttaa ei ole", () => {
    expect(lueKentta(teksti, "Urakoitsija")).toBeNull()
  })
})

describe("vaiheTilasta", () => {
  it("kaantaa Fingridin tilan omaksi vaiheeksi", () => {
    expect(vaiheTilasta("Rakentaminen")).toBe("Rakenteilla")
    expect(vaiheTilasta("Suunnittelu")).toBe("Suunnittelu")
    expect(vaiheTilasta("YVA-menettely")).toBe("Ideointi")
    expect(vaiheTilasta("Ympäristöselvitys")).toBe("Ideointi")
  })

  it("hylkaa valmistuneen", () => {
    /* Valmis voimajohto ei ole mahdollisuus — sama kuin GRK ja NRC. */
    expect(vaiheTilasta("Hanke on valmistunut")).toBeNull()
  })

  it("tuntematon tila ei ole valmistunut, joten se otetaan mukaan", () => {
    expect(vaiheTilasta("Jokin muu vaihe")).toBe("Suunnittelu")
    expect(vaiheTilasta(null)).toBeNull()
  })
})

describe("jasennaHankesivu", () => {
  it("lukee otsikon ja kentat", () => {
    const sivu = jasennaHankesivu(HANKESIVU)
    expect(sivu?.otsikko).toBe("Espoo-Framnäs")
    expect(sivu?.tyyppi).toBe("Voimajohto")
    expect(sivu?.tila).toBe("Suunnittelu")
    expect(sivu?.sijainti).toBe("Espoo, Uusimaa")
  })

  it("ei ota sivupalkin hankelistaa mukaan kuvaukseen", () => {
    /*
     * Koko `.content` sisaltaa sivupalkin, jossa on kaikkien 52
     * hankkeen nimet. Ne vuotaisivat jokaisen hankkeen kuvaukseen.
     */
    const sivu = jasennaHankesivu(HANKESIVU)
    expect(sivu?.teksti).toContain("Espoon ja Framnäsin")
    expect(sivu?.teksti).not.toContain("Anttila-Länsisalmi")
    expect(sivu?.teksti).not.toContain("Harjulinja")
  })

  it("palauttaa null kun sivu ei ole hankesivu", () => {
    expect(jasennaHankesivu("<html><body>ei mitaan</body></html>")).toBeNull()
  })
})
