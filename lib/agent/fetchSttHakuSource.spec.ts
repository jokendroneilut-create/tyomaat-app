import { describe, it, expect } from "vitest"
import { resolveDeveloper, resolveParties } from "./fetchSttHakuSource"
import { extractStreetAddress } from "./extractStreetAddress"

describe("extractStreetAddress", () => {
  it("poimii katuosoitteen numeroineen", () => {
    expect(
      extractStreetAddress("Kohde sijaitsee osoitteessa Jokisuuntie 12, Siilinjärvi")
    ).toBe("Jokisuuntie 12")
    expect(extractStreetAddress("Mannerheimintie 14, Helsinki")).toBe("Mannerheimintie 14")
  })

  /*
   * Numero vaaditaan, jottei pelkkä paikannimi mene osoitteeksi:
   * kaupunkitason sijainti ei kelpaa täsmäytyksen todisteeksi.
   */
  it("ei poimi osoitetta ilman numeroa", () => {
    expect(extractStreetAddress("Rakennustyöt Siilinjärven Jokisuuntiellä")).toBeNull()
    expect(extractStreetAddress("Hanke toteutetaan Siilinjärvellä")).toBeNull()
  })

  it("sietää tyhjän", () => {
    expect(extractStreetAddress(null)).toBeNull()
  })
})

describe("resolveParties", () => {
  /*
   * Mitattu tapaus: "Rakennusliike Soimu rakentaa Siilinjärvelle uuden
   * palloiluhallin", tilaajana HMT-Areena Oy. Kannassa luki rakennuttajana
   * Soimu, joka on pääurakoitsija.
   */
  it("siirtää julkaisijan urakoitsijaksi kun tilaaja mainitaan", () => {
    const parties = resolveParties(
      "Rakennusliike Soimu Oy",
      "Rakennusliike Soimu rakentaa Siilinjärvelle uuden palloiluhallin",
      "HMT-Areena Oy:n merkittävä hanke edistää alueen liikuntaolosuhteita."
    )

    expect(parties.developer).toBe("HMT-Areena Oy")
    expect(parties.builder).toBe("Rakennusliike Soimu Oy")
  })

  it("tunnistaa tilaajan myös tilaajana-muodosta", () => {
    const parties = resolveParties(
      "Lujatalo Oy",
      "Lujatalo rakentaa koulun Ouluun",
      "Hankkeen tilaajana toimii Oulun Tilapalvelut Oy."
    )

    expect(parties.developer).toBe("Oulun Tilapalvelut Oy")
    expect(parties.builder).toBe("Lujatalo Oy")
  })

  /*
   * Nimi katkaistaan yhtiömuotoon. Ilman sitä kaappaus jatkui seuraavaan
   * virkkeeseen: mitattu leipätekstistä "HMT-Areena Oy. Tilaajien".
   */
  it("ei kaappaa seuraavaa virkettä nimeen", () => {
    const parties = resolveParties(
      "Rakennusliike Soimu Oy",
      "Rakennusliike Soimu rakentaa palloiluhallin",
      "Hankkeen tilaajana toimii HMT-Areena Oy. Tilaajien vahva tahtotila näkyy."
    )

    expect(parties.developer).toBe("HMT-Areena Oy")
  })

  /*
   * Perustajaurakointi: yhtiö rakentaa omaan lukuunsa, jolloin se todella ON
   * rakennuttaja. Tilaajaa ei mainita, joten sääntö ei laukea. Julkaisijan
   * nimeen perustuva arvaus olisi mennyt tässä väärin.
   */
  it("ei koske omaan lukuun rakentamiseen", () => {
    const parties = resolveParties(
      "Bonava Suomi Oy",
      "Bonava rakentaa Espooseen uuden asuinkerrostalon",
      "Kohde valmistuu vuonna 2027."
    )

    expect(parties.developer).toBe("Bonava Suomi Oy")
    expect(parties.builder).toBeNull()
  })

  it("ei aseta julkaisijaa urakoitsijaksi jos tilaaja on sama yritys", () => {
    const parties = resolveParties(
      "Peab Oy",
      "Peab rakentaa",
      "Peab Oy:n hanke etenee aikataulussa."
    )

    expect(parties.builder).toBeNull()
  })

  it("viranomaisjulkaisija ei ole rakennuttaja eikä urakoitsija", () => {
    const parties = resolveParties(
      "Lupa- ja valvontavirasto",
      "Bull Team Oy:n laajennuksen YVA-menettely käynnistyy",
      null
    )

    expect(parties.developer).toContain("Bull Team Oy")
    expect(parties.builder).toBeNull()
  })
})

describe("resolveDeveloper", () => {
  it("käyttää julkaisijaa kun se on yritys", () => {
    expect(resolveDeveloper("Skanska Oy", "Uusi toimitalo Espooseen", null)).toBe(
      "Skanska Oy"
    )
  })

  /*
   * Viranomainen tiedottaa muiden hankkeista, joten julkaisija ei kelpaa
   * rakennuttajaksi. Mitattu tapaus tuotannosta: 9 ehdokasta sai
   * rakennuttajaksi "Lupa- ja valvontavirasto".
   */
  it("ei ota viranomaista rakennuttajaksi vaan poimii toteuttajan tekstistä", () => {
    const developer = resolveDeveloper(
      "Lupa- ja valvontavirasto",
      "Bull Team Oy:n ja WeKas Oy:n laajennuksen YVA-menettely käynnistyy Toholammilla",
      "Bull Team Oy ja WeKas Oy on toimittanut Lupa- ja valvontavirastolle ympäristövaikutusten arviointiohjelman."
    )

    expect(developer).toContain("Bull Team Oy")
    expect(developer).toContain("WeKas Oy")
    expect(developer).not.toContain("valvontavirasto")
  })

  it("jättää tyhjäksi kun viranomaisen tiedotteesta ei löydy yritystä", () => {
    expect(
      resolveDeveloper(
        "Lupa- ja valvontavirasto",
        "Uusiutuvan energian nopean kehittämisen alueiden nimeämismenettely",
        "Kuulutus on nähtävillä."
      )
    ).toBeNull()
  })

  it("tunnistaa viranomaisen eri kirjoitusasuissa", () => {
    for (const publisher of [
      "Aluehallintovirasto",
      "Pohjois-Pohjanmaan ELY-keskus",
      "Ympäristöministeriö",
    ]) {
      expect(resolveDeveloper(publisher, "Hanke käynnistyy", null)).toBeNull()
    }
  })

  /*
   * Osa virastoista on aitoja rakennuttajia, eivät lupaviranomaisia -
   * ne eivät saa pudota listalle.
   */
  it("säilyttää rakennuttajavirastot", () => {
    expect(resolveDeveloper("Väylävirasto", "Ratahanke", null)).toBe("Väylävirasto")
    expect(resolveDeveloper("Senaatti-kiinteistöt", "Toimitilahanke", null)).toBe(
      "Senaatti-kiinteistöt"
    )
  })

  it("sietää tyhjät", () => {
    expect(resolveDeveloper(null, null, null)).toBeNull()
  })
})
