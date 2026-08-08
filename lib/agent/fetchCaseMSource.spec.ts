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
