import { describe, expect, it } from "vitest"
import { parseRovaniemiContacts } from "./rovaniemiContacts"

/*
 * Kolme lohkoa sellaisina kuin ne Kaavatorin sivuilla ovat 13.11.2026.
 * Kopioitu sivulta, ei kirjoitettu uudelleen.
 */
const A = `Lisätietoja:
Kaavoituspäällikkö Markku Pyhäjärvi, puh. 016 322 8927
sähköposti: etu.sukunimi@rovaniemi.fi
Kaavasuunnittelija Ville Mäkitalo, puh. 040 671 2219 sähköposti: etu.sukunimi@rovaniemi.fi`

const B = `Lisätietoja:
Konsultti ja kaavanlaatija Jarmo Lokio / Arkkitehtitoimisto Jarmo Lokio Oy, puh. 044 700 2155
sähköposti: jarmo.lokio@lokio.fi
Kaavoituspäällikkö Markku Pyhäjärvi, puh. 016 322 8927
sähköposti: etu.sukunimi@rovaniemi.fi
Kaavasuunnittelija Ville Mäkitalo, puh. 040 671 2219 sähköposti: etu.sukunimi@rovaniemi.fi`

const C = `Lisätietoja:
maankäyttöasiantuntija Niina Alanenpää puh. 016 322 8743
kaavoituspäällikkö Markku Pyhäjärvi puh. 016 322 8927
sähköposti: etu.sukunimi@rovaniemi.fi`

describe("parseRovaniemiContacts", () => {
  it("A: kaksi henkilöä, malliosoitetta ei tallenneta", () => {
    expect(parseRovaniemiContacts(A)).toEqual([
      { name: "Markku Pyhäjärvi", title: "Kaavoituspäällikkö", phone: "016 322 8927", email: null, organization: null },
      { name: "Ville Mäkitalo", title: "Kaavasuunnittelija", phone: "040 671 2219", email: null, organization: null },
    ])
  })

  it("B: konsultin oma osoite ja toimisto erotellaan", () => {
    const tulos = parseRovaniemiContacts(B)
    expect(tulos).toHaveLength(3)
    expect(tulos[0]).toEqual({
      name: "Jarmo Lokio",
      title: "Konsultti ja kaavanlaatija",
      phone: "044 700 2155",
      email: "jarmo.lokio@lokio.fi",
      organization: "Arkkitehtitoimisto Jarmo Lokio Oy",
    })
    /* Kaupungin väki jakaa malliosoitteen, joten heille ei osoitetta. */
    expect(tulos[1].name).toBe("Markku Pyhäjärvi")
    expect(tulos[1].email).toBeNull()
    expect(tulos[2].name).toBe("Ville Mäkitalo")
    expect(tulos[2].email).toBeNull()
  })

  it("C: pienellä kirjoitettu nimike ei valu nimeen", () => {
    expect(parseRovaniemiContacts(C)).toEqual([
      { name: "Niina Alanenpää", title: "maankäyttöasiantuntija", phone: "016 322 8743", email: null, organization: null },
      { name: "Markku Pyhäjärvi", title: "kaavoituspäällikkö", phone: "016 322 8927", email: null, organization: null },
    ])
  })

  it("yksi henkilö ja oikea osoite: osoite liitetään", () => {
    expect(
      parseRovaniemiContacts("Lisätietoja: Kaavasuunnittelija Ville Mäkitalo, puh. 040 671 2219, ville.makitalo@rovaniemi.fi")
    ).toEqual([
      {
        name: "Ville Mäkitalo",
        title: "Kaavasuunnittelija",
        phone: "040 671 2219",
        email: "ville.makitalo@rovaniemi.fi",
        organization: null,
      },
    ])
  })

  it("ilman puhelinnumeroa tulkitaan yhdeksi henkilöksi", () => {
    expect(
      parseRovaniemiContacts("Lisätietoja: Kaavasuunnittelija Ville Mäkitalo, ville.makitalo@rovaniemi.fi")
    ).toEqual([
      {
        name: "Ville Mäkitalo",
        title: "Kaavasuunnittelija",
        phone: null,
        email: "ville.makitalo@rovaniemi.fi",
        organization: null,
      },
    ])
  })

  it("pelkkä malliosoite ei tuota merkintää", () => {
    expect(parseRovaniemiContacts("Lisätietoja: sähköposti: etu.sukunimi@rovaniemi.fi")).toEqual([])
  })

  it("tyhjä syöte ei kaadu", () => {
    expect(parseRovaniemiContacts(null)).toEqual([])
    expect(parseRovaniemiContacts("")).toEqual([])
    expect(parseRovaniemiContacts("Lisätietoja:")).toEqual([])
  })
})

describe("D: osoite ennen puhelinnumeroa", () => {
  const D = [
    "Lisätietoja:",
    "Maankäyttöasiantuntija Ville Pitkänen, sähköposti: ville.pitkanen@rovaniemi.fi, puh. 040 621 5125",
    "Kaavoituspäällikkö Markku Pyhäjärvi, sähköposti: markku.pyhajarvi@rovaniemi.fi, puh. 016 322 8927",
  ].join("\n")

  it("kumpikin saa oman osoitteensa", () => {
    expect(parseRovaniemiContacts(D)).toEqual([
      { name: "Ville Pitkänen", title: "Maankäyttöasiantuntija", phone: "040 621 5125", email: "ville.pitkanen@rovaniemi.fi", organization: null },
      { name: "Markku Pyhäjärvi", title: "Kaavoituspäällikkö", phone: "016 322 8927", email: "markku.pyhajarvi@rovaniemi.fi", organization: null },
    ])
  })
})

describe("E: kansainvalinen numeromuoto", () => {
  const E = [
    "Lisätietoja:",
    "Kaavasuunnittelija Elias Ritola, sähköposti: elias.ritola@rovaniemi.fi, puh. +358 40 194 6870",
    "Kaavoituspäällikkö Markku Pyhäjärvi, sähköposti: markku.pyhajarvi@rovaniemi.fi, puh. 016 322 8927",
  ].join("\n")

  it("plussalla alkava numero tunnistetaan omaksi henkilokseen", () => {
    expect(parseRovaniemiContacts(E)).toEqual([
      { name: "Elias Ritola", title: "Kaavasuunnittelija", phone: "+358 40 194 6870", email: "elias.ritola@rovaniemi.fi", organization: null },
      { name: "Markku Pyhäjärvi", title: "Kaavoituspäällikkö", phone: "016 322 8927", email: "markku.pyhajarvi@rovaniemi.fi", organization: null },
    ])
  })
})
