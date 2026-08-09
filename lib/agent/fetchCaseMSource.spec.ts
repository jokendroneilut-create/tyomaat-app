import { describe, it, expect } from "vitest"
import {
  decodeEntities,
  extractItemText,
  isConstructionSubject,
  parseSearchResults,
} from "./fetchCaseMSource"

describe("decodeEntities", () => {
  /*
   * CaseM palauttaa entiteetit koodattuina. Ilman purkua ääkköset jäisivät
   * muotoon "P&ouml;yt&auml;kirja" sekä kuvaukseen että täsmäytykseen.
   */
  it("purkaa suomalaiset ääkköset", () => {
    expect(decodeEntities("P&ouml;yt&auml;kirja &amp; esityslista")).toBe(
      "Pöytäkirja & esityslista"
    )
  })

  it("jättää tuntemattoman entiteetin rauhaan", () => {
    expect(decodeEntities("a &tuntematon; b")).toBe("a &tuntematon; b")
  })
})

describe("extractItemText", () => {
  /*
   * Murupolku antaa kokouspäivän, jota käytetään tuoreusrajaan. Ensimmäinen
   * versio katkaisi tekstin merkkijonosta "Toimielimet >", jota asiasivulla
   * ei ole - kuvaus alkoi silloin murupolulla.
   */
  it("poimii kokouspäivän murupolusta", () => {
    const html =
      "<p>Asunto- ja kiinteist&ouml;lautakunta &gt; Kokous 7.9.2022 &gt; " +
      "Nekalan koulun sis&auml;ilmakorjaus. " +
      "Hankkeen tavoitteena on korjata koulun sis&auml;ilmaongelmat ja muuttaa tilat kulttuurikäyttöön.</p>"
    const r = extractItemText(html)
    expect(r.meetingDate?.getFullYear()).toBe(2022)
    expect(r.meetingDate?.getMonth()).toBe(8)
    expect(r.text).not.toMatch(/Kokous 7\.9\.2022/)
  })

  it("palauttaa null liian lyhyestä tekstistä", () => {
    expect(extractItemText("<p>Lyhyt</p>").text).toBeNull()
  })

  /*
   * Asiasivun vasemmassa laidassa on viranhaltijavalikko, joka tulee
   * HTML:ssä ennen varsinaista asiaa. Rovaniemellä se on 93 nimikettä.
   * Murupolkukatkaisu ei sitä poistanut, ja koska kohdetyyppi luetaan
   * tekstin alusta, purku-urakka sai valikon rehtoreista tyypin "Koulu".
   */
  it("jättää viranhaltijavalikon pois sisältöalueen ulkopuolelta", () => {
    const html =
      '<div id="Content_sidenaviArea"><ul class="nav nav-list">' +
      "<li><a>Apulaisrehtori Korkalovaaran peruskoulu</a></li>" +
      "<li><a>Koulunjohtaja Hirvaan koulu</a></li>" +
      "<li><a>Kirjastonjohtaja</a></li></ul></div>" +
      '<div class="span6 center-content" id="ContentStart" role="main">' +
      "<h1> &sect; 4 Sipolantien 9 purku-urakka </h1>" +
      "<p>Tilapalvelukeskus on kilpailuttanut kokonaisurakkana " +
      "Sipolantie 9:n purku-urakan. Ty&ouml;t alkavat 13.4.2026.</p></div>" +
      '<div class="span3 right-content">Palaute Rovaniemen kaupungin kirjaamo</div>'
    const r = extractItemText(html)
    expect(r.text).not.toMatch(/Apulaisrehtori|Koulunjohtaja|Kirjastonjohtaja/)
    expect(r.text).not.toMatch(/right-content|Palaute/)
    expect(r.text?.startsWith("Sipolantien 9 purku-urakka")).toBe(true)
  })

  /*
   * Leikkaus alkaa avaustagin sulkevasta merkistä. Tunnisteesta aloitettuna
   * tagin loppuosa jäisi tekstiksi: 'id="ContentStart" role="main">'.
   */
  it("ei jätä avaustagin loppuosaa tekstiin", () => {
    const html =
      '<div id="ContentStart" role="main"><p>Kohteen purku-urakka on ' +
      "kilpailutettu rajoitettuna menettelyn&auml; kansallisen kynnysarvon " +
      "alittavana urakkahankintana vuonna 2026.</p></div>"
    expect(extractItemText(html).text).not.toMatch(/ContentStart|role=/)
  })

  /*
   * Kokouspäivä on murupolussa eli sisältöalueen ULKOPUOLELLA. Jos se
   * luettaisiin rajatusta alueesta, tuoreusraja lakkaisi toimimasta
   * hiljaisesti.
   */
  it("lukee kokouspäivän murupolusta vaikka sisältöalue on rajattu", () => {
    const html =
      "<p>Tilajaosto &gt; Kokous 13.9.2023 &gt; Napsun monitoimitalo</p>" +
      '<div id="ContentStart" role="main"><p>Napsun monitoimitalohankkeen ' +
      "kehitysvaiheen tulokset ja p&auml;&auml;t&ouml;s toteutusvaiheeseen " +
      "siirtymisest&auml; k&auml;siteltiin kokouksessa.</p></div>"
    const r = extractItemText(html)
    expect(r.meetingDate?.getFullYear()).toBe(2023)
    expect(r.text).not.toMatch(/Tilajaosto/)
  })
})

describe("isConstructionSubject", () => {
  /*
   * CaseM:n haku on kokotekstihaku, joten hakusana osuu asiakirjan runkoon
   * eika otsikkoon. Kaikki alla olevat tulivat oikeista hakutuloksista
   * sanalla "peruskorjaus" tai "tarveselvitys".
   */
  it("hylkaa otsikot joissa ei ole rakentamisen sanastoa", () => {
    for (const title of [
      "Ajankohtaiset asiat",
      "Ilmoitusasiat / Tekninen lautakunta",
      "Viranhaltijapäätösten otto-oikeus",
      "Vuoden 2026 talousarvion täytäntöönpano, tekninen lautakunta",
      "Tilapalvelu-liikelaitoksen neljännesvuosikatsaus 6/2025",
      "Hankeavustuksen myöntäminen, Satakunnan Sininauha ry",
    ]) {
      expect(isConstructionSubject(title), title).toBe(false)
    }
  })

  it("hylkaa nimitys-, kunnossapito- ja kaava-asiat", () => {
    for (const title of [
      "Nuorisovaltuuston jäsenen nimeäminen Zillarin nuorisotilan tarveselvitystyöryhmään",
      "LISÄPYKÄLÄ: Vammaisneuvoston edustaja Korundin peruskorjauksen suunnitteluun",
      "Itä-Porin aurausurakka vuosille 2025 - 2026",
      "Pohjois-Porin nurmikoiden ja puhtaanapidon hoitourakka 2026 - 2027",
      "Mäntyluoto 65. kaupunginosan asemakaavan laajennus",
      "Poikkeamishakemus tontille Rimminkatu 17, Ala-Pispala, omakotitalon rakentaminen",
    ]) {
      expect(isConstructionSubject(title), title).toBe(false)
    }
  })

  it("pitaa hankepaatokset", () => {
    for (const title of [
      "Kilpisen koulun peruskorjauksen hankesuunnitelma",
      "Kauramäen päiväkotikoulun hankesuunnitelma",
      "Pirkkala-Linnainmaa -raitiotien allianssisopimus",
      "Lentokenttäalueen rakennushankkeen rahoitus",
      "Neljän tuulen koulun toteutusmuoto ja kilpailutuksen toteuttaminen",
      "Hankintapäätös rakennusten purku-urakasta, Koulutie 12, Säynätsalo, Jyväskylä",
    ]) {
      expect(isConstructionSubject(title), title).toBe(true)
    }
  })
})

describe("parseSearchResults", () => {
  it("poimii polun ja otsikon samasta linkistä", () => {
    const html =
      '<a href="/fi-FI/content/278564/23">Nekalan koulun sis&auml;ilmakorjaus</a>'
    expect(parseSearchResults(html)).toEqual([
      { path: "/fi-FI/content/278564/23", title: "Nekalan koulun sisäilmakorjaus" },
    ])
  })
})
