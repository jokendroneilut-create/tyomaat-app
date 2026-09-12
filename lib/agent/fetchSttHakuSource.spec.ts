import { describe, it, expect } from "vitest"
import {
  extractBuilderFromText,
  extractClientFromText,
  resolveDeveloper,
  resolveParties,
} from "./fetchSttHakuSource"
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

/*
 * TILAAJA ALLATIIVISTA (D-188). Perusmuoto todennetaan samasta tekstista,
 * ja kuntanimi on paikka eika tilaaja.
 */
describe("extractClientFromText - allatiivi", () => {
  it("lukee perusmuodon tekstista eika katkaise nimea", () => {
    const teksti =
      "Senaatti-kiinteistot rakentaa Tullille uudisrakennuksen Vantaalle. Tullin uudet tilat valmistuvat 2028. Tulli on yksi valtion suurimmista."
    expect(extractClientFromText("Senaatti ja NCC solmivat sopimuksen", teksti)).toBe("Tulli")
  })

  it("ei kirjaa kuntaa tilaajaksi", () => {
    expect(
      extractClientFromText(
        "Kreate rakentaa Tampereelle matkaterminaalin",
        "Kreate rakentaa Tampereelle matkaterminaalin ja sujuvammat kulkuyhteydet."
      )
    ).toBeNull()
  })

  it("ei kirjaa kuntaa tilaajaksi myoskaan astevaihtelun yli", () => {
    expect(
      extractClientFromText(
        "Uusi S-market Pihtiputaalle",
        "Osuuskauppa Keskimaa rakentaa Pihtiputaalle uuden S-marketin nykyisen myymalan viereen."
      )
    ).toBeNull()
  })

  /* Kunnan organisaatio ON tilaaja: nimessa on organisaatiosana. */
  it("sailyttaa kunnan organisaationa", () => {
    expect(
      extractClientFromText(
        "Peab ja Evijarven kunta sopivat",
        "Peab ja Evijarven kunta ovat sopineet koulun rakentamisesta."
      )
    ).toBe("Evijarven kunta")
  })
})

/*
 * RAKENTAJA TEKSTISTA (D-189). Kuviot on luettu aineistosta: kaikki 27
 * riviä kaytiin lapi ja jokainen oli pääurakoitsija.
 */
describe("extractBuilderFromText", () => {
  it.each([
    ["rakentamisesta vastaa Consti Korjausrakentaminen Oy. Pääsuunnittelijana toimii Sarc", "Consti Korjausrakentaminen Oy"],
    ["Hankkeen pääurakoitsijana toimii Hallirakentajat Lappi Oy, ja suunnittelusta vastaa Ramboll", "Hallirakentajat Lappi Oy"],
    ["Hankkeen pääurakoitsija on Mestek Oy. Avainsanat liikenne", "Mestek Oy"],
    ["Urakoitsijana toimii Oteran Oy ja urakan valvonnasta vastaa WSP Finland Oy", "Oteran Oy"],
    ["hankkeen KVR-urakoitsijana toimii Aura Rakennus Lansi-Suomi Oy", "Aura Rakennus Lansi-Suomi Oy"],
    ["Pääurakoitsijana toimii Rakennusliike J. Malm Oy. Lisatiedot:", "Rakennusliike J. Malm Oy"],
  ])("lukee rakentajan: %s", (teksti, odotettu) => {
    expect(extractBuilderFromText(null, teksti)).toBe(odotettu)
  })

  it("ei lue aliurakoitsijaa", () => {
    expect(extractBuilderFromText(null, "Aliurakoitsijana toimii Putkiasennus Oy.")).toBeNull()
  })

  it("ei lue valvojaa eika suunnittelijaa", () => {
    expect(extractBuilderFromText(null, "Urakan valvonnasta vastaa WSP Finland Oy.")).toBeNull()
    expect(extractBuilderFromText(null, "Pääsuunnittelijana toimii UKI Arkkitehdit.")).toBeNull()
  })
})

describe("resolveParties - rakentaja tekstista", () => {
  it("ei jata tilaajaa rakentajaksi kun teksti nimeaa urakoitsijan", () => {
    const teksti =
      "Senaatti-kiinteistot rakentaa uudisrakennuksen Tullille. Rakentamisesta vastaa NCC, jonka kanssa Senaatti-kiinteistot on allekirjoittanut sopimuksen."
    const osapuolet = resolveParties("Senaatti-kiinteistot", "Senaatti ja NCC solmivat sopimuksen", teksti)

    expect(osapuolet.builder).toBe("NCC")
  })

  it("tayttaa rakentajan kun julkaisija on rakennuttaja", () => {
    const teksti = "Niipperintie 97:n rakentamisesta vastaava SSA Rakennus Oy on aiemmin toteuttanut kohteen."
    const osapuolet = resolveParties("Espoon Asunnot", "85-asuntoinen kerrostalo", teksti)

    expect(osapuolet.developer).toBe("Espoon Asunnot")
    expect(osapuolet.builder).toBe("SSA Rakennus Oy")
  })

  it("ei kirjaa samaa yritysta molempiin rooleihin", () => {
    const teksti = "Rakentamisesta vastaa Lujatalo Oy."
    expect(resolveParties("Lujatalo Oy", "Lujatalo rakentaa", teksti).builder).toBeNull()
  })
})

/* Kuivaharjoituksen paljastamat rajatapaukset (D-189). */
describe("extractBuilderFromText - rajatapaukset", () => {
  it("ei jatka kaappausta virkkeen yli", () => {
    expect(
      extractBuilderFromText(
        null,
        "Hoivakodin suunnittelusta ja rakentamisesta vastaa Rakennusliike Lapti. Palveluntuottajana toimii Attendo."
      )
    ).toBe("Rakennusliike Lapti")
  })

  it("ei lue tilaajaa urakoitsijaksi allatiivista", () => {
    expect(
      extractBuilderFromText(null, "Pääurakoitsijana Elenialle hankkeessa toimii Omexom.")
    ).toBeNull()
  })

  it("ei kirjaa samaa yritysta molempiin rooleihin yhtiomuodon erosta huolimatta", () => {
    const teksti = "Hankkeen rakentamisesta vastaa Rakennusliike Lapti."
    expect(resolveParties("Rakennusliike Lapti Oy", "Lapti rakentaa hoivakodin", teksti).builder).toBeNull()
  })
})
