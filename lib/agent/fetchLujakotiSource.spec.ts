import { describe, expect, it } from "vitest"

import {
  asuntomaaraTekstista,
  kaupunkiKohteesta,
  parseLujakotiPage,
  vaiheMyyntitilasta,
} from "./fetchLujakotiSource"

describe("vaiheMyyntitilasta", () => {
  it("lukee vaiheen myyntitilasta", () => {
    expect(vaiheMyyntitilasta("Ennakkomarkkinoinnissa").vaihe).toBe("Suunnittelu")
    expect(vaiheMyyntitilasta("Suunnitteilla").vaihe).toBe("Suunnittelu")
    expect(vaiheMyyntitilasta("Rakenteilla").vaihe).toBe("Rakenteilla")
  })

  /*
   * "Muuttovalmis" on valmis rakennus josta myydaan viela asuntoja.
   * Rakentaminen on ohi, joten se ei ole hankeloyto - sama linja kuin
   * Lujatalon referensseilla (108 valmista 115:sta).
   */
  it("ei anna vaihetta valmiille kohteelle", () => {
    expect(vaiheMyyntitilasta("Muuttovalmis").vaihe).toBeNull()
  })

  it("palauttaa nullin kun tilaa ei ole", () => {
    expect(vaiheMyyntitilasta("Tontti: vuokrattu").vaihe).toBeNull()
    expect(vaiheMyyntitilasta(null).vaihe).toBeNull()
  })
})

describe("asuntomaaraTekstista", () => {
  it("lukee asuntomaaran", () => {
    expect(asuntomaaraTekstista("johon on rakenteilla yhteensa 45 asuntoa")).toBe(45)
    expect(asuntomaaraTekstista("51 uutta kotia")).toBe(51)
  })

  it("ei arvaa kun lukua ei ole", () => {
    expect(asuntomaaraTekstista("moderni taloyhtio Hatanpaalla")).toBeNull()
  })
})

describe("kaupunkiKohteesta", () => {
  /* Osoitekentassa on usein pelkka katu, nimessa kaupunki aina. */
  it("lukee kaupungin taloyhtion nimesta", () => {
    expect(kaupunkiKohteesta("Asunto Oy Tampereen Pioni", "Boijenkatu 6")).toBe("Tampere")
  })

  it("kayttaa osoitetta kun nimessa ei ole kaupunkia", () => {
    expect(kaupunkiKohteesta("Lujakoteja Koskelaan", "Sammonkatu 26, 70500 Kuopio")).toBe("Kuopio")
  })
})

/*
 * TILA LUETAAN OMASTA KENTASTAAN. Markkinointiteksti sanoo "johon on
 * RAKENTEILLA yhteensa 45 asuntoa", vaikka kohteen tila on
 * "Ennakkomarkkinoinnissa" eika rakentaminen ole alkanut (mitattu
 * 6.9.2026). Tekstista luettuna vaihe olisi vaara.
 */
const SIVU = `
<h1 class="vc-heading">Asunto Oy Tampereen Pioni</h1>
<div class="vc-content">
  <div class="realty-meta">
    <ul>
      <li><i class="fa fa-map-marker"></i> <span id="lujakoti-address">Boijenkatu 6</span></li>
      <li><i class="fa fa-info-circle"></i> Ennakkomarkkinoinnissa</li>
      <li><i class="fa fa-info-circle"></i> Tontti: vuokrattu</li>
    </ul>
  </div>
  <p>Asunto Oy Tampereen Pioni on moderni kohde, johon on rakenteilla yhteensa 45 asuntoa.</p>
</div>
`

describe("parseLujakotiPage", () => {
  it("lukee kentat omista elementeistaan", () => {
    const sivu = parseLujakotiPage(SIVU)
    expect(sivu?.name).toBe("Asunto Oy Tampereen Pioni")
    expect(sivu?.address).toBe("Boijenkatu 6")
    expect(sivu?.tila).toBe("Ennakkomarkkinoinnissa")
    expect(sivu?.phase).toBe("Suunnittelu")
    expect(sivu?.apartments).toBe(45)
  })

  /*
   * Sivun ylin lista on navigaatiovalikko. Leipatekstista luettuna se
   * paatyi jokaisen kohteen kuvaukseksi ("Luja Lujatalo Lujabetoni...").
   */
  it("ei ota navigaatiota kuvaukseksi", () => {
    const sivu = parseLujakotiPage(
      `<ul><li>Etusivu</li><li>Uusi koti</li><li>Blogi</li></ul>${SIVU}`
    )
    expect(sivu?.description).not.toMatch(/Etusivu/)
    expect(sivu?.description).toMatch(/moderni kohde/)
  })

  it("palauttaa nullin ilman otsikkoa", () => {
    expect(parseLujakotiPage("<div>ei mitaan</div>")).toBeNull()
  })
})
