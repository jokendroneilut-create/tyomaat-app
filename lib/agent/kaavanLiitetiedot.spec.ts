import { describe, expect, it } from "vitest"
import { haeKaavanLiitetiedot, kaavanAsiakirja, lohkonOmaTeksti, naytaaSisallysluettelolta } from "./kaavanLiitetiedot"

const OAS = "https://www.toholampi.fi/wp-content/uploads/2026/05/Datakeskuksen_alueen_AK_OAS_11052026.pdf"
const LIITTEET = [{ label: "Datakeskuksen alueen OAS-11052026", url: OAS }]

describe("kaavanLiitetiedot (D-450)", () => {
  it("ei pidä liitteen nimeä kuvauksena", () => {
    expect(lohkonOmaTeksti("Datakeskuksen alueen OAS-11052026 ", LIITTEET)).toBeNull()
  })

  it("hyväksyy lohkon oman virkkeen", () => {
    expect(
      lohkonOmaTeksti("Kunnanhallitus käynnisti kaavoituksen datakeskusta varten alueelle Kiertokangas. Datakeskuksen alueen OAS-11052026", LIITTEET)
    ).toBe("Kunnanhallitus käynnisti kaavoituksen datakeskusta varten alueelle Kiertokangas.")
  })

  it("valitsee OAS:n liitteistä", () => {
    expect(kaavanAsiakirja(LIITTEET)).toBe(OAS)
  })

  it("lukee asiakirjasta kuvauksen ja aloitteentekijän", async () => {
    const teksti = `1.2 Suunnittelutehtävä – Mitä on tekeillä, mitä suunnitellaan?
Toholammin kunnanhallitus on päättänyt käynnistää asemakaavan laatimisen kokouksessaan 13.4.2026 § 80. Kaavoitus on tullut ajankohtaiseksi Greensky Energy Oy:n aloitteesta.
Toimijan tavoitteena on toteuttaa alueelle datakeskuskokonaisuus, joka rakennettaisiin vaiheittain. Hankkeen ensimmäisessä vaiheessa alueelle on tavoitteena toteuttaa n. 100 MW:n datakeskus.`
    const tulos = await haeKaavanLiitetiedot(LIITTEET, async () => teksti)
    expect(tulos.asiakirja).toBe(OAS)
    expect(tulos.aloitteentekija).toBe("Greensky Energy Oy")
  })
})

describe("naytaaSisallysluettelolta (Ähtäri 27.11.2026)", () => {
  it("tunnistaa liimautuneen sisällysluettelon", () => {
    expect(naytaaSisallysluettelolta("Asemakaavan tavoitteet24 4.4.1Lähtökohta-aineiston antamat tavoitteet24 4.5Asemakaavaratkaisun vaihtoehdot ja niiden vaikutukset25 4.5.1Asemakaavaratkaisun valinta")).toBe(true)
  })
  it("ei hylkää tavallista kuvausta", () => {
    expect(naytaaSisallysluettelolta("Kaava-alueen kokonaispinta-ala on noin 1104 hehtaaria ja Ähtärin kaupungin alueella noin 669 hehtaaria. Kortteli 713 sijaitsee 4.5 km päässä.")).toBe(false)
  })
})
