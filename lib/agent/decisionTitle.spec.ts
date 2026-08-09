import { describe, it, expect } from "vitest"
import { genericizeDecisionTitle } from "./decisionTitle"

describe("genericizeDecisionTitle", () => {
  /*
   * Mitattu rivi. Sama silta on jonossa myös nimellä "Puhjon risteyssilta
   * (W) korjausurakka, 2026 (KU) – urakan hankinta": sama hanke kahdessa
   * päätösvaiheessa, mutta otsikot eivät täsmänneet.
   */
  it("poistaa päätöslajin ja salassapitomerkinnän", () => {
    expect(
      genericizeDecisionTitle(
        "Puhjon risteyssilta (W) korjausurakka 2026 (KU), korjausurakan " +
          "kilpailuttaminen, kilpailutusperiaatteet (salassa pidettävä, " +
          "julkisuuslaki 6.1 § 2)"
      )
    ).toBe("Puhjon risteyssilta (W) korjausurakka 2026 (KU)")
  })

  it("poistaa ajatusviivalla erotetun päätöslajin", () => {
    expect(
      genericizeDecisionTitle("Näsin tekojään perusparantaminen - urakoitsijan valinta")
    ).toBe("Näsin tekojään perusparantaminen")
  })

  /*
   * KAUPUNGINOSA EI OLE ROSKAA. Yleisin pilkulla erotettu häntä
   * päätösaineistossa on kaupunginosa (Malmi 19, Vartiokylä 15, Kaarela
   * 15), ja se on sijaintitietoa. Poisto perustuu siksi sanastoon eikä
   * välimerkkeihin.
   */
  it("säilyttää kaupunginosan ja osoitteen", () => {
    expect(
      genericizeDecisionTitle("Leikkipuisto Myllynsiipi, puistosuunnitelma, Vartiokylä")
    ).toBe("Leikkipuisto Myllynsiipi, puistosuunnitelma, Vartiokylä")
    expect(
      genericizeDecisionTitle("Postipuun päiväkodin hankesuunnitelma (Åbohusvägen 3, Östra centrum)")
    ).toBe("Postipuun päiväkodin hankesuunnitelma (Åbohusvägen 3, Östra centrum)")
  })

  /*
   * VÄLIVIIVA VAATII VÄLILYÖNNIN EDELLÄ. Ilman sitä kuvio osui yhdyssanan
   * sisään ja otsikko katkesi: "purku-urakoitsijan valinta" -> "purku".
   */
  it("ei katkaise yhdyssanaa väliviivan kohdalta", () => {
    expect(
      genericizeDecisionTitle("Puuppolan hoivasairaalan purku-urakoitsijan valinta")
    ).toBe("Puuppolan hoivasairaalan purku-urakoitsijan valinta")
  })

  it("poistaa useamman peräkkäisen päätöslajin", () => {
    expect(
      genericizeDecisionTitle(
        "Asfalttiurakka 2026 (2027) (2028), rakennusurakan kilpailuttaminen, kilpailutusperiaatteet"
      )
    ).toBe("Asfalttiurakka 2026 (2027) (2028)")
  })

  /*
   * Vuosiluvun poisto on valinnainen ja oletuksena pois: mitattuna se
   * sulautti neljä eri vuoden päällystysurakkaa yhdeksi
   * ("Katujen uudelleenpäällystykset 2021/2023/2025").
   */
  it("säilyttää vuosiluvun oletuksena", () => {
    expect(genericizeDecisionTitle("Katujen uudelleenpäällystykset 2023")).toBe(
      "Katujen uudelleenpäällystykset 2023"
    )
  })

  it("poistaa vuosiluvun vain pyydettäessä", () => {
    expect(
      genericizeDecisionTitle("Katujen uudelleenpäällystykset 2023", { dropYear: true })
    ).toBe("Katujen uudelleenpäällystykset")
  })

  /*
   * Vuosilukua ei irroteta ilmauksen keskeltä: "vuodelle 2026" katkesi
   * muotoon "...vuodelle".
   */
  it("ei irrota vuotta ilmauksesta vaikka pyydettäisiin", () => {
    expect(
      genericizeDecisionTitle(
        "Urakoitsijoiden valinta koskien pieniä purkutöitä vuodelle 2026",
        { dropYear: true }
      )
    ).toBe("Urakoitsijoiden valinta koskien pieniä purkutöitä vuodelle 2026")
  })

  /*
   * Yleisin hallinnollinen hanta koko aineistossa: 177 otsikkoa paattyy
   * sanaan "hyvaksyminen", joista 172 muotoa <asiakirja>n hyvaksyminen.
   * Pelkka hannan poisto jattaisi genetiivin roikkumaan, joten poisto ja
   * sijamuodon muunnos tehdaan yhdessa.
   */
  it("muuttaa hyväksymisen asiakirjan nimeksi", () => {
    expect(
      genericizeDecisionTitle(
        "Tuohimäen päiväkodin elinkaarta jatkavan korjauksen hankesuunnitelman hyväksyminen"
      )
    ).toBe("Tuohimäen päiväkodin elinkaarta jatkavan korjauksen hankesuunnitelma")
  })

  it("osaa monikon ja muut asiakirjatyypit", () => {
    expect(genericizeDecisionTitle("Alppiharju, puistosuunnitelman hyväksyminen")).toBe(
      "Alppiharju, puistosuunnitelma"
    )
    expect(genericizeDecisionTitle("Katujen katusuunnitelmien hyväksyminen")).toBe(
      "Katujen katusuunnitelmat"
    )
    expect(genericizeDecisionTitle("Koulun tarveselvityksen hyväksyminen")).toBe(
      "Koulun tarveselvitys"
    )
  })

  /*
   * Tunnistamattomasta genetiivista otsikko jatetaan koskematta: vaara
   * nominatiivi olisi huonompi kuin pitka otsikko.
   */
  it("jattaa tuntemattoman genetiivin rauhaan", () => {
    const title = "Kokonaiskustannusarvion muutoksen hyväksyminen"
    expect(genericizeDecisionTitle(title)).toBe(title)
  })

  it("sietää tyhjän otsikon", () => {
    expect(genericizeDecisionTitle(null)).toBe("")
    expect(genericizeDecisionTitle("")).toBe("")
  })
})

describe("genericizeDecisionTitle – rinnasteinen asiakirja", () => {
  /*
   * "Mikkelänpellon puistosuunnitelman ja sillan siltasuunnitelman
   * hyväksyminen" jäi muotoon jossa sijamuoto vaihteli saman rinnastuksen
   * sisällä: "...puistosuunnitelmaN ja ...siltasuunnitelma".
   */
  it("muuntaa myös ja-sanaa edeltävän asiakirjan", () => {
    expect(
      genericizeDecisionTitle(
        "Mikkelänpellon puistosuunnitelman ja Mikkelänpellon sillan siltasuunnitelman hyväksyminen"
      )
    ).toBe("Mikkelänpellon puistosuunnitelma ja Mikkelänpellon sillan siltasuunnitelma")
  })

  /*
   * Rajaus asiakirjatyyppeihin: tavallinen genetiivi ennen ja-sanaa on osa
   * kohteen nimeä eikä saa muuttua.
   */
  it("ei koske kohteen nimen genetiiviin", () => {
    expect(
      genericizeDecisionTitle("Koulun ja päiväkodin hankesuunnitelman hyväksyminen")
    ).toBe("Koulun ja päiväkodin hankesuunnitelma")
  })
})
