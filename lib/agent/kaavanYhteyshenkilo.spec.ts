import { describe, expect, it } from "vitest"

import { kaavanYhteyshenkilot } from "./kaavanYhteyshenkilo"

/* Ote Lieksan Brahean korttelin 2027 selostuksesta (17.9.2026). */
const SELOSTUS =
  "lvelevien rakennusten ja laitosten alue (ET). Kaavanlaatija Lieksan kaupunki / " +
  "kaupunkiympäristöt palvelualue / maankäytön suunnittelija Reino Hirvonen " +
  "Kaava-asiakirjat Kaavasuunnittelija Maria Hyvärinen Lieksassa 17.9.2026 Kaavaselostus"

describe("kaavanYhteyshenkilot", () => {
  it("poimii nimikkeen peraassa olevan nimen", () => {
    const loydot = kaavanYhteyshenkilot(SELOSTUS)
    const nimet = loydot.map((l) => l.nimi)

    expect(nimet).toContain("Reino Hirvonen")
    expect(nimet).toContain("Maria Hyvärinen")
    expect(loydot.find((l) => l.nimi === "Reino Hirvonen")?.rooli.toLowerCase()).toBe(
      "maankäytön suunnittelija"
    )
  })

  /*
   * "Kaavanlaatija Lieksan kaupunki" on organisaatio, ei henkilo.
   * Juuri tallainen osuma tekee automaattisesta poiminnasta vaarallisen.
   */
  it("ei poimi organisaatiota nimeksi", () => {
    const nimet = kaavanYhteyshenkilot(SELOSTUS).map((l) => l.nimi)
    expect(nimet).not.toContain("Lieksan kaupunki")
    expect(nimet).not.toContain("Lieksan Kaupunki")
  })

  /* Pidempi nimike voittaa: ei "suunnittelija Reino" vaan koko nimike. */
  it("tunnistaa monisanaisen nimikkeen kokonaan", () => {
    const loydot = kaavanYhteyshenkilot("maankäytön suunnittelija Reino Hirvonen")
    expect(loydot).toHaveLength(1)
    expect(loydot[0].rooli.toLowerCase()).toBe("maankäytön suunnittelija")
  })

  it("tunnistaa yleisimmat nimikkeet", () => {
    for (const nimike of [
      "Kaavoitusarkkitehti",
      "kaava-arkkitehti",
      "Kaavoituspäällikkö",
      "kaavoittaja",
    ]) {
      expect(kaavanYhteyshenkilot(`${nimike} Matti Meikäläinen`)[0]?.nimi).toBe("Matti Meikäläinen")
    }
  })

  it("sietaa yhdysnimen ja valimerkit", () => {
    expect(kaavanYhteyshenkilot("Kaavoittaja: Aki-Lassi Virtanen")[0]?.nimi).toBe("Aki-Lassi Virtanen")
  })

  /* Sama henkilo kahdessa kohdassa on yksi yhteyshenkilo. */
  it("ei toista samaa nimea", () => {
    const teksti = "Kaavoittaja Matti Meikäläinen ... Kaavasuunnittelija Matti Meikäläinen"
    expect(kaavanYhteyshenkilot(teksti)).toHaveLength(1)
  })

  /* Tyhja on parempi kuin vaara: ilman nimiketta ei arvata. */
  it("palauttaa tyhjan kun nimiketta ei ole", () => {
    expect(kaavanYhteyshenkilot("Lieksan kaupunki Pielisentie 3 81700 Lieksa")).toEqual([])
    expect(kaavanYhteyshenkilot("")).toEqual([])
    expect(kaavanYhteyshenkilot(null)).toEqual([])
  })

  it("ei poimi nimea jos nimikkeen perassa on muuta", () => {
    expect(kaavanYhteyshenkilot("kaavoittaja vastaa kysymyksiin")).toEqual([])
  })
})

/*
 * Puhelin ja sahkoposti vain nimen vierelta (D-362). Mitattu rivi:
 * Ulvilan selostuksen kansilehti.
 */
describe("yhteystiedot nimen vierelta", () => {
  const ULVILA =
    "Ulvilan kaupunki puh. 02 677 4511 kaupunkikehitys@ulvila.fi www.ulvila.fi " +
    "Asiaa hoitaa: Kaavoitusarkkitehti Mikko Toivanen puh. 0400 134 777 mikko.toivanen@ulvila.fi " +
    "Vireilletulo: 25.9.2025"

  it("poimii puhelimen ja sahkopostin nimen perasta", () => {
    expect(kaavanYhteyshenkilot(ULVILA)[0]).toMatchObject({
      nimi: "Mikko Toivanen",
      rooli: "Kaavoitusarkkitehti",
      puhelin: "0400 134 777",
      sahkoposti: "mikko.toivanen@ulvila.fi",
    })
  })

  /* Yhteinen laatikko ei ole taman henkilon osoite. */
  it("ei kirjaa yhteista laatikkoa henkilon nimiin", () => {
    const teksti = "Kaavoittaja Matti Meikäläinen puh. 040 123 4567 kirjaamo@kunta.fi"
    expect(kaavanYhteyshenkilot(teksti)[0]).toMatchObject({
      nimi: "Matti Meikäläinen",
      puhelin: "040 123 4567",
      sahkoposti: null,
    })
  })

  /* Paljas numerosarja voi olla kaavatunnus; puh.-merkinta vaaditaan. */
  it("ei poimi numeroa ilman puhelinmerkintaa", () => {
    const teksti = "Kaavoittaja Matti Meikäläinen Kaavatunnus 0400 134 777"
    expect(kaavanYhteyshenkilot(teksti)[0]?.puhelin).toBeNull()
  })

  /*
   * Toisen henkilon numero ei saa tarttua: ikkuna on 120 merkkia.
   * Taytteena on tekstia eika valilyonteja, koska funktio tiivistaa
   * valilyonnit yhdeksi -- ensimmainen versio tasta testista mittasi
   * siksi omaa tayteprosessiaan eika saantoa.
   */
  it("ei ota kaukana olevaa numeroa", () => {
    const teksti =
      "Kaavoittaja Matti Meikäläinen " +
      "suunnittelualue sijaitsee kaupungin keskustan tuntumassa ja rajautuu ".repeat(3) +
      "puh. 040 123 4567"
    expect(kaavanYhteyshenkilot(teksti)[0]?.puhelin).toBeNull()
  })
})
