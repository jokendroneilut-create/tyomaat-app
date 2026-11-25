import { describe, expect, it } from "vitest"
import { jasennaAloitteentekija, jasennaOasAloite, valitseOasLinkki } from "./oasAloite"

const TUNNISTE = [
  "      Dnro KLA/1719/53.02/2025  2 (13) ",
  "Kangasalan kaupunki Kaavoitus Vaihde  ",
  "PL 50, 36201 Kangasala Myllystenpohjantie 2 A p. 03 5655 3000  www.kangasala.fi ",
]

/* Kangasala 912/914 Tarastenjärvi, OAS tark. 16.6.2026 (sivu 2). */
const TARASTE = [
  ...TUNNISTE,
  " ",
  "Aloite  ",
  "Aloitteen asemakaavan muuttamiseksi on tehnyt Tarasten Kiertotalousalue Oy. Hakemus ",
  "asemakaavan muuttamiseksi saapui 26.3.2025 ja sitä on tarkennettu 7.1.2026, 13.5.2026 ja ",
  "27.5.2026.   ",
  "Aloitteen jättäjän tarkoituksena on muun muassa, että: ",
  "• Nykyistä suurempi osa alueella harjoitettavasta toiminnasta sijoittuu sisätiloihin, mikä ",
  "vaatii rakennusoikeuden kasvattamista korttelialueilla. ",
  "• Kidetien katualue muutetaan osaksi korttelialuetta. ",
  "Tavoitteet ",
  "Suunnittelun tavoitteena on mahdollistaa Tarasten kiertotalousalueen kehittämi- ",
  "nen toimijoiden tarpeita vastaavaksi. ",
  "Kaavamuutokseen liittyy maankäyttösopimus, joka tehdään ennen kuin valtuusto ",
  "hyväksyy kaavaehdotuksen. ",
  "Suunnittelualueen yleiskuvaus  ",
  "Asemakaavan suunnittelualue sijaitsee Tarastenjärven alueella Suinulan kaupunginosassa. ",
  ...TUNNISTE,
].join("\n")

describe("jasennaOasAloite", () => {
  it("Tarastenjärvi: tekijä, aloitteen kohdat ja tavoitteet; tunnisteet ja yleiskuvaus pois", () => {
    const r = jasennaOasAloite(TARASTE)
    expect(r.aloitteentekija).toBe("Tarasten Kiertotalousalue Oy")
    expect(r.kuvaus).toBe(
      [
        "Aloitteen asemakaavan muuttamiseksi on tehnyt Tarasten Kiertotalousalue Oy. Hakemus asemakaavan muuttamiseksi saapui 26.3.2025 ja sitä on tarkennettu 7.1.2026, 13.5.2026 ja 27.5.2026. Aloitteen jättäjän tarkoituksena on muun muassa, että:",
        "– Nykyistä suurempi osa alueella harjoitettavasta toiminnasta sijoittuu sisätiloihin, mikä vaatii rakennusoikeuden kasvattamista korttelialueilla.",
        "– Kidetien katualue muutetaan osaksi korttelialuetta.",
        "",
        "Tavoitteet: Suunnittelun tavoitteena on mahdollistaa Tarasten kiertotalousalueen kehittäminen toimijoiden tarpeita vastaavaksi. Kaavamuutokseen liittyy maankäyttösopimus, joka tehdään ennen kuin valtuusto hyväksyy kaavaehdotuksen.",
      ].join("\n")
    )
  })

  it("kaupungin tai maanomistajan aloite: kuvaus kyllä, rakennuttajaa ei", () => {
    const r = jasennaOasAloite(
      [
        "Aloite/hakija",
        "Asemakaavan laadinta on aloitettu yksityisen maanomistajan aloitteesta vuonna 2013.",
        "Tavoitteet",
        "Alueelle tavoitellaan monipuolista asuntotuotantoa, työpaikka- ja palvelutoimintoja.",
      ].join("\n")
    )
    expect(r.aloitteentekija).toBeNull()
    expect(r.kuvaus).toBe(
      "Asemakaavan laadinta on aloitettu yksityisen maanomistajan aloitteesta vuonna 2013.\n\nTavoitteet: Alueelle tavoitellaan monipuolista asuntotuotantoa, työpaikka- ja palvelutoimintoja."
    )
  })

  it("SUUNNITTELUN ALOITE -otsikko (ranta-asemakaava)", () => {
    const r = jasennaOasAloite(
      ["SUUNNITTELUN ALOITE", "Aloitteen ranta-asemakaavan laatimisesta on tehnyt alueen maanomistaja.", "SUUNNITTELUN LÄHTÖKOHDAT", "Ympäristö"].join("\n")
    )
    expect(r.aloitteentekija).toBeNull()
    expect(r.kuvaus).toBe("Aloitteen ranta-asemakaavan laatimisesta on tehnyt alueen maanomistaja.")
  })

  it("monipalstainen pohja: luku pysähtyy seuraavan luvun otsikkoon", () => {
    const r = jasennaOasAloite(
      ["Aloite/hakija", "Kaavan laati-", "minen on tullut vireille tar-", "peesta muuttaa kadunpitoa.", "(5) Lähtötiedot", "Maanomistus"].join("\n")
    )
    expect(r.kuvaus).toBe("Kaavan laatiminen on tullut vireille tarpeesta muuttaa kadunpitoa.")
  })

  it("ilman Aloite-lukua palauttaa tyhjän", () => {
    expect(jasennaOasAloite("Osallistumis- ja arviointisuunnitelma\nSuunnittelualue")).toEqual({ aloitteentekija: null, kuvaus: null })
    expect(jasennaOasAloite(null)).toEqual({ aloitteentekija: null, kuvaus: null })
  })
})

describe("jasennaAloitteentekija", () => {
  it("eri sanamuodot", () => {
    expect(jasennaAloitteentekija("Aloitteen asemakaavan muuttamiseksi on tehnyt Kiinteistö Oy Taloherttua. Hakemus saapui.")).toBe("Kiinteistö Oy Taloherttua")
    expect(jasennaAloitteentekija("Kaavamuutosta on hakenut Lidl Suomi Ky.")).toBe("Lidl Suomi Ky")
    expect(jasennaAloitteentekija("Aloitteen tekijä: Helios 2 Dewberry Oy.")).toBe("Helios 2 Dewberry Oy")
  })
  it("kaupunki, maanomistaja ja pienellä alkava eivät kelpaa", () => {
    expect(jasennaAloitteentekija("Aloitteen asemakaavoituksen jatkamiseksi on tehnyt kaupunki ja kaavoituksen käynnistämisestä päätti lautakunta.")).toBeNull()
    expect(jasennaAloitteentekija("Aloitteen ranta-asemakaavan laatimisesta ovat tehneet alueen maanomistajat.")).toBeNull()
  })
})

describe("valitseOasLinkki", () => {
  it("uusin tarkistettu, ei palauteraporttia, liitettä eikä yleisötilaisuuden ohjelmaa", () => {
    const U = "https://www.kangasala.fi/wp-content/uploads/sites/2"
    expect(
      valitseOasLinkki([
        { href: `${U}/2026/05/816-osallistumis-ja-arviointisuunnitelma-tark.11.5.2026.pdf` },
        { href: `${U}/2026/05/816-palauteraportti-osallistumis-ja-arviointisuunnitelma.pdf` },
        { href: `${U}/2025/07/816-osallistumis-ja-arviointisuunnitelma.pdf` },
      ])
    ).toBe(`${U}/2026/05/816-osallistumis-ja-arviointisuunnitelma-tark.11.5.2026.pdf`)
    expect(
      valitseOasLinkki([
        { href: `${U}/2025/05/Yleisotilaisuuden-ohjelma-ja-osallistumisohjeet.pdf`, teksti: "osallistumis- ja arviointisuunnitelma" },
        { href: `${U}/2025/05/875-osallistumis-ja-arviointisuunnitelma_uusi.pdf` },
      ])
    ).toBe(`${U}/2025/05/875-osallistumis-ja-arviointisuunnitelma_uusi.pdf`)
    expect(valitseOasLinkki([{ href: `${U}/2026/06/912-kaavaluonnos.pdf` }])).toBeNull()
  })
})

describe("jasennaAloitteentekija: yhtiön aloitteesta (Toholampi 25.11.2026)", () => {
  it("poimii yhtiön genetiivimuodosta", () => {
    expect(jasennaAloitteentekija("Kaavoitus on tullut ajankohtaiseksi Greensky Energy Oy:n aloitteesta. Toimijan tavoitteena")).toBe("Greensky Energy Oy")
    expect(jasennaAloitteentekija("Toholammin kunnanhallitus hyväksyi Fu-Gen Energia Oy:n kaavoitusaloitteen ja käynnisti kaavan")).toBe("Fu-Gen Energia Oy")
    expect(jasennaAloitteentekija("Fu-Gen Oy:n toimittama kaavoitusaloite on hyväksytty Toholammin kaupunginhallituksessa 17.8.2026 § 6.")).toBe("Fu-Gen Oy")
  })

  it("ei poimi kunnan aloitetta yhtiöksi", () => {
    expect(jasennaAloitteentekija("Asemakaavan laatiminen on käynnistetty Ulvilan kaupungin aloitteesta.")).toBeNull()
  })
})
