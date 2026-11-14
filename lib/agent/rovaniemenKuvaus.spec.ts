import { describe, expect, it } from "vitest"
import { korjaaLiimattuKuvaus, rovaniemenKuvaus } from "./rovaniemenKuvaus"

/* Aito RSS-kuvaus 14.11.2026 (Mellavaara, D-417). */
const MELLAVAARA_HTML =
  '<a href="http://www.rovaniemi.fi/Asuminen-ja-ymparisto/Kaavoitus-ja-maankaytto/Kaavatori/Asemakaava?showmodul=213&CityAreaId=30">Pohtimolampi, kaupunginosa nro 20</a><br />Arctic Lapland Investment Oy on hakenut asemakaavan laatimista omistamalleen kiinteistölle 698-408-428-6 Mellavaarassa. Hakija esittää kaavanlaatijaksi Arkkitehtitoimisto Jarmo Lokio Oy:tä.<br />\n<br />\nAlueella on voimassa ranta-alueen osalta Lääninhallituksen 6.2.1979 vahvistama Mellalammen rantakaava.&nbsp;&nbsp;'

describe("rovaniemenKuvaus", () => {
  it("kaupunginosalinkki pois ja rivinvaihdot välilyönneiksi", () => {
    expect(rovaniemenKuvaus(MELLAVAARA_HTML)).toBe(
      "Arctic Lapland Investment Oy on hakenut asemakaavan laatimista omistamalleen kiinteistölle 698-408-428-6 Mellavaarassa. Hakija esittää kaavanlaatijaksi Arkkitehtitoimisto Jarmo Lokio Oy:tä. Alueella on voimassa ranta-alueen osalta Lääninhallituksen 6.2.1979 vahvistama Mellalammen rantakaava."
    )
  })

  it("tyhjä pysyy tyhjänä", () => {
    expect(rovaniemenKuvaus(null)).toBeNull()
    expect(rovaniemenKuvaus("   ")).toBeNull()
  })
})

describe("korjaaLiimattuKuvaus", () => {
  it("irrottaa kannassa jo olevan liimatun kaupunginosan", () => {
    expect(
      korjaaLiimattuKuvaus("Pohtimolampi, kaupunginosa nro 20Arctic Lapland Investment Oy on hakenut asemakaavan laatimista.")
    ).toBe("Arctic Lapland Investment Oy on hakenut asemakaavan laatimista.")
  })

  it("numero toistuu heti: kaupunginosa 13 + '13. kaupunginosan'", () => {
    expect(
      korjaaLiimattuKuvaus("Ylikylä, kaupunginosa nro 1313. kaupunginosan virkistysalueella on oleva ajoyhteys.")
    ).toBe("13. kaupunginosan virkistysalueella on oleva ajoyhteys.")
  })

  it("ei koske tekstiin jossa kaupunginosa on osa virkettä", () => {
    const t = "Kaava koskee kaupunginosa nro 3 korttelia 12."
    expect(korjaaLiimattuKuvaus(t)).toBe(t)
  })
})
