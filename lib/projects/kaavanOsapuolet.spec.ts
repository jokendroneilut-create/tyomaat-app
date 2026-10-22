import { describe, it, expect } from "vitest"
import { kaavanOsapuoli, siivoaKaavanNimi } from "./kaavanOsapuolet"
import { onLuokkasana } from "./kaavanRakennuttaja"

/*
 * Jokainen tapaus on AITO kaavakuvauksen katkelma (23.10.2026), ei
 * keksitty. Virheelliset tapaukset ovat niita jotka mittaus paljasti.
 */
describe("kaavanOsapuoli", () => {
  it("lukee kumppanuussopimuksen osapuolen", () => {
    expect(
      kaavanOsapuoli(
        "Turun kaupungin ja TKU-Rakennus Oy:n välinen määräaikainen innovaatiokumppanuus Puropellon ja Samppalinnan koulutonttien kehittämisestä."
      )
    ).toBe("TKU-Rakennus Oy")
  })

  it("lukee kaavoitusaloitteen tekijän", () => {
    expect(
      kaavanOsapuoli(
        "Kunnanhallitus hyväksyi Ilmatar Pielavesi Oy:n kaavoitusaloitteen ja käynnisti oikeusvaikutteisen tuulivoimaosayleiskaavan laatimisen."
      )
    ).toBe("Ilmatar Pielavesi Oy")
  })

  it("lukee hakemuksen tekijän", () => {
    expect(
      kaavanOsapuoli(
        "Asemakaavan muutostyö on käynnistynyt YIT Suomi Oy:n hakemuksesta. Hankkeesta laaditaan toteuttamissopimus."
      )
    ).toBe("YIT Suomi Oy")
  })

  it("lukee Vantaan hakijakentän kuvaustekstistä", () => {
    expect(
      kaavanOsapuoli("Lisätietoja hakijasta: Sato-Asunnot Oy Sijainti Kaavamuutosalue sijaitsee Korsossa.")
    ).toBe("Sato-Asunnot Oy")
  })

  it("ei ota osion otsikkoa mukaan nimeen", () => {
    expect(
      kaavanOsapuoli("Lisätietoja hakijasta: Kiinteistö Oy Myyrinmäki Sijainti Kuohukuja 1–3 ja katualueita.")
    ).toBe("Kiinteistö Oy Myyrinmäki")
  })

  it("ei poimi kaavan laatijaa eli konsulttia", () => {
    expect(
      kaavanOsapuoli("Kaavan laatijana toimii Sitowise Oy. Kaavan laatimisen on tilannut Karttaako Oy.")
    ).toBeNull()
  })

  it("jättää katkenneen nimen poimimatta", () => {
    /* "Napapiirin Energia ja Vesi Oy" katkeaa pieneen sidesanaan. */
    expect(
      kaavanOsapuoli("Napapiirin Energia ja Vesi Oy on hakenut asemakaavan muutosta kortteliin 9070.")
    ).toBeNull()
  })

  it("säilyttää genetiivin erottaman listan ensimmäisen jälkeisen", () => {
    expect(
      kaavanOsapuoli("Asemakaavatyö on käynnistetty Wärtsilä Finland Oy:n ja EPV Energia Oy:n aloitteesta.")
    ).toBe("EPV Energia Oy")
  })

  it("ei riko CamelCase-nimeä", () => {
    expect(
      kaavanOsapuoli("Lautakunta päätti hyväksyä WestWind Oy:n päivitetty kaavoitusaloite ja käynnistää kaavan.")
    ).toBe("WestWind Oy")
  })

  it("pudottaa otsikkonumeron nimen edestä", () => {
    expect(
      kaavanOsapuoli("Ratantaus, kaupunginosa nro 3RovaLappi Rakennus Oy on hakenut asemakaavan muutosta.")
    ).toBe("RovaLappi Rakennus Oy")
  })

  it("pudottaa sijapäätteisen sanan nimen edestä", () => {
    expect(
      kaavanOsapuoli("Kaavamuutoksella Rajakiiri Oy haluaa päivittää merituulipuiston osayleiskaavan.")
    ).toBe("Rajakiiri Oy")
  })

  it("ei poimi mitään kun kuvauksessa ei ole osapuolta", () => {
    expect(
      kaavanOsapuoli("Suunnittelualue sijaitsee Pohjan kunnan Åminnen asemakaava-alueella rajoittuen golfkenttään.")
    ).toBeNull()
  })
})

describe("siivoaKaavanNimi", () => {
  it("hylkää paljaan etumuodon", () => {
    expect(siivoaKaavanNimi("Kiinteistö Oy")).toBeNull()
    expect(siivoaKaavanNimi("Asunto Oy")).toBeNull()
  })

  it("hylkää nimen ilman yhtiömuotoa", () => {
    expect(siivoaKaavanNimi("Vantaan kaupunki")).toBeNull()
  })

  it("irrottaa yhtiömuodon seuraavasta sanasta", () => {
    expect(siivoaKaavanNimi("ABO Energy Suomi OyYhteystiedot")).toBe("ABO Energy Suomi Oy")
  })
})

describe("onLuokkasana", () => {
  it("tunnistaa maanomistuksen lajin", () => {
    expect(onLuokkasana("Yksityinen")).toBe(true)
    expect(onLuokkasana("Kaupunki; Yksityinen")).toBe(true)
    expect(onLuokkasana("Muu")).toBe(true)
  })

  it("ei pidä aitoa nimeä luokkasanana", () => {
    expect(onLuokkasana("Metsähallitus")).toBe(false)
    expect(onLuokkasana("Joensuun kaupunki")).toBe(false)
    expect(onLuokkasana("Sato-Asunnot Oy")).toBe(false)
    expect(onLuokkasana("")).toBe(false)
  })
})
