import { describe, it, expect } from "vitest"
import { haveSameEnergySite, haveDifferentEnergySites, isEnergyProjectName } from "./energySite"

describe("haveSameEnergySite", () => {
  /*
   * Viisi varmennettua paria aineistosta 12.8.2026: sama hanke tuli
   * meille sekä YVA-lähteestä että kunnan kaavoituksesta. Ennen tätä
   * sääntöä kaksi ensimmäistä eivät tuottaneet täsmäytyksessä osumaa
   * lainkaan ja loput jäivät 38-50 pisteeseen (yhdistys vaatii 70).
   */
  it("tunnistaa saman hankkeen YVA:n ja kaavan välillä", () => {
    expect(
      haveSameEnergySite(
        "Niinimäen tuulivoimahanke, Hattula, Hämeenlinna",
        "Hattulan Niinimäen tuulivoimaosayleiskaava",
        "Hattula"
      )
    ).toBe(true)

    expect(
      haveSameEnergySite(
        "Kupinavaaran tuulivoimahanke, Ranua, Pudasjärvi, Rovaniemi",
        "Kupinavaara itäinen ja läntinen tuulivoimaosayleiskaava",
        "Ranua"
      )
    ).toBe(true)

    expect(
      haveSameEnergySite(
        "Vaarinkankaan tuulivoimahanke, Puolanka",
        "Vaarinkankaan tuulivoimapuiston osayleiskaava",
        "Puolanka"
      )
    ).toBe(true)

    expect(
      haveSameEnergySite(
        "Luikesneva–Susinevan tuulivoimahanke, Ikaalinen ja Parkano",
        "Luikesneva-Susinevan tuulivoimapuisto",
        "Ikaalinen"
      )
    ).toBe(true)

    /*
     * Kaavarivin otsikko ei nimeä hanketyyppiä lainkaan, joten tyyppi
     * luetaan kuvauksesta. Ilman kuvausta pari jää löytymättä - se on
     * tietoinen raja, ei unohdus.
     */
    expect(
      haveSameEnergySite(
        "Kummunmaan ja Repojängän tuulivoimahanke, Ylitornio, Tornio",
        "Kummunmaa ja Repojänkä, Winda Energy Oy",
        "Ylitornio"
      )
    ).toBe(false)

    expect(
      haveSameEnergySite(
        "Kummunmaan ja Repojängän tuulivoimahanke, Ylitornio, Tornio",
        "Kummunmaa ja Repojänkä, Winda Energy Oy",
        "Ylitornio",
        null,
        "Osayleiskaavalla mahdollistetaan tuulivoimapuiston rakentaminen."
      )
    ).toBe(true)
  })

  /*
   * SIIKALATVAN SEITSEMÄN TUULIPUISTOA. Sama kunta ja sama hanketyyppi,
   * eri paikannimi - juuri se tapaus jossa liian löysä sääntö yhdistäisi
   * kunnan kaikki tuulipuistot yhdeksi hankkeeksi.
   */
  it("ei yhdistä saman kunnan eri tuulipuistoja", () => {
    const kiviineva = "Kivinevan tuuli- ja aurinkovoimahanke, Siikalatva"
    const muut = [
      "HONKAKANKAAN TUULI- AURINKOVOIMAHANKE",
      "NEITTÄVÄNVAARAN TUULIVOIMAPUISTOHANKE",
      "TUULIKAARRON TUULIVOIMAPUISTOHANKE",
      "PEURANEVAN AURINKO- JA TUULIVOIMAPUISTOHANKE",
      "TAIKKONEVAN TUULIVOIMAPUISTOHANKE",
      "Uljuan tuulivoimahanke, Siikalatva",
    ]
    for (const other of muut) {
      expect(haveSameEnergySite(kiviineva, other, "Siikalatva")).toBe(false)
    }
  })

  it("löytää oman parinsa myös Siikalatvalla", () => {
    expect(
      haveSameEnergySite(
        "Kivinevan tuuli- ja aurinkovoimahanke, Siikalatva",
        "KIVINEVAN TUULI- JA AURINKOPUISTOHANKE",
        "Siikalatva"
      )
    ).toBe(true)
  })

  /*
   * ILMANSUUNTA EROTTAA OSAHANKKEET. Kauhajoella "Pallonevan pohjoinen" ja
   * "Pallonevan eteläinen" ovat eri hankkeita eri yhtiöillä, vaikka
   * paikannimi on sama.
   */
  it("ei yhdistä saman paikan pohjoista ja eteläistä osahanketta", () => {
    expect(
      haveSameEnergySite(
        "ATP Palloneva Oy:n Pallonevan pohjoisen aurinko- ja tuulivoimahanke, Kauhajoki, Kurikka",
        "Pallonevan eteläinen aurinko- ja tuulivoimapuiston osayleiskaava Windfarm Palloneva Oy",
        "Kauhajoki"
      )
    ).toBe(false)
  })

  it("yhdistää saman paikan ja saman suunnan", () => {
    expect(
      haveSameEnergySite(
        "ATP Palloneva Oy:n Pallonevan pohjoisen aurinko- ja tuulivoimahanke, Kauhajoki, Kurikka",
        "Pallonevan pohjoinen aurinko- ja tuulivoimaosayleiskaava ATP Palloneva",
        "Kauhajoki"
      )
    ).toBe(true)
  })

  /*
   * KUNTANIMI EI OLE PAIKANNIMI. Otsikot luettelevat vaikutusalueen kunnat,
   * joten ilman pudotusta kaksi eri saman seudun hanketta yhdistyisi
   * pelkän yhteisen kuntanimen perusteella.
   */
  it("ei yhdistä pelkän yhteisen kuntanimen perusteella", () => {
    expect(
      haveSameEnergySite(
        "Ahvenlammen tuulivoimahanke, Hattula, Hämeenlinna",
        "Hattulan Niinimäen tuulivoimaosayleiskaava",
        "Hattula"
      )
    ).toBe(false)
  })

  /*
   * SÄHKÖNSIIRTO EI ERISTÄ HANKETTA. Tuulipuiston otsikossa mainitaan lähes
   * aina myös liityntä, joten ilman pudotusta kaksi eri hanketta samassa
   * kunnassa osuisi toisiinsa pelkän yhteisen "sähkönsiirron" perusteella.
   * Mitattu: väärä osuma sai 90 ja oikea vain 83.
   */
  it("ei yhdistä eri hankkeita sähkönsiirron perusteella", () => {
    expect(
      haveSameEnergySite(
        "Uusimon tuulivoimapuisto ja sähkönsiirto Pihtipudas",
        "Varisvuoren tuulivoimapuisto (Pihtipudas) ja sähkönsiirto (Pihtipudas)",
        "Pihtipudas"
      )
    ).toBe(false)

    expect(
      haveSameEnergySite(
        "Uusimon tuulivoimapuisto ja sähkönsiirto Pihtipudas",
        "Leppäkankaan tuulivoimahanke ja sähkönsiirto, Pihtipudas, Reisjärvi",
        "Pihtipudas"
      )
    ).toBe(false)

    expect(
      haveSameEnergySite(
        "Uusimon tuulivoimapuisto ja sähkönsiirto Pihtipudas",
        "Uusimon tuulivoimapuiston osayleiskaava",
        "Pihtipudas"
      )
    ).toBe(true)
  })

  it("ei osu muihin kuin energiahankkeisiin", () => {
    expect(isEnergyProjectName("Parolan asemakaavan muutos (S-market)")).toBe(false)
    expect(
      haveSameEnergySite(
        "Niinimäen koulun peruskorjaus",
        "Hattulan Niinimäen tuulivoimaosayleiskaava",
        "Hattula"
      )
    ).toBe(false)
  })

  it("sietää tyhjän", () => {
    expect(haveSameEnergySite(null, "Hattulan Niinimäen tuulivoimaosayleiskaava", "Hattula")).toBe(
      false
    )
    expect(haveSameEnergySite("", "", null)).toBe(false)
  })
  /*
   * LAAJENNUS ON ERI HANKE. Sama paikannimi, mutta oma kaavansa ja omat
   * urakkansa. Symmetriavaatimus kuten ilmansuunnalla: laajennus erottaa
   * vain jos toinen puoli on ilman.
   */
  it("ei yhdista laajennusta alkuperaiseen puistoon", () => {
    expect(
      haveSameEnergySite(
        "Kaukasennevan tuulivoimapuiston laajennus, Kannus",
        "Kaukasennevan tuulivoimapuiston osayleiskaava",
        "Kannus"
      )
    ).toBe(false)
  })

  it("yhdistaa laajennuksen laajennukseen", () => {
    expect(
      haveSameEnergySite(
        "Kaukasen tuulivoimapuiston laajennus, Kannus",
        "Kaukasennevan tuulivoimapuiston laajennus osayleiskaava",
        "Kannus"
      )
    ).toBe(true)
  })

})

describe("haveDifferentEnergySites", () => {
  /*
   * MITATTU KUVIO. Tervolassa kuusi eri tuulipuistoa ristiinpariutui
   * 15 duplikaattipariksi, koska otsikoista nelja sanaa viidesta on
   * samoja. 68 uudesta ehdokkaasta 51 oli tata kuviota.
   */
  it("tunnistaa eri tuulipuistot samassa kunnassa", () => {
    expect(
      haveDifferentEnergySites(
        "Vitsakankaan tuulivoimaa koskeva osayleiskaava",
        "Pitkämaan tuulivoimaa koskeva osayleiskaava",
        "Tervola"
      )
    ).toBe(true)

    expect(
      haveDifferentEnergySites(
        "NEITTÄVÄNVAARAN TUULIVOIMAPUISTOHANKE",
        "ULJUAN TUULIVOIMAPUISTOHANKE",
        "Siikalatva"
      )
    ).toBe(true)
  })

  /* Sama kohde ei saa laueta - se on haveSameEnergySite:n tapaus. */
  it("ei laukea samasta kohteesta", () => {
    expect(
      haveDifferentEnergySites(
        "Mustasuo-Tynnyrikorven tuuli- ja aurinkovoimahanke",
        "Mustasuo-Tynnyrikorven tuuli- ja aurinkovoimahanke, Oulu",
        "Oulu"
      )
    ).toBe(false)

    expect(
      haveDifferentEnergySites(
        "Niinimäen tuulivoimahanke, Hattula",
        "Hattulan Niinimäen tuulivoimaosayleiskaava",
        "Hattula"
      )
    ).toBe(false)
  })

  it("ei laukea kun toinen ei ole energiahanke", () => {
    expect(
      haveDifferentEnergySites(
        "Vitsakankaan tuulivoimaa koskeva osayleiskaava",
        "Keskustan päiväkodin peruskorjaus",
        "Tervola"
      )
    ).toBe(false)
  })

  /*
   * PAIKANNIMEN PUUTTUMINEN EI OLE TODISTE. Tyhja on parempi kuin
   * vaara myos tahan suuntaan.
   */
  it("ei laukea ilman tunnistettavaa paikannimea", () => {
    expect(haveDifferentEnergySites("Datakeskus", "Aurinkovoimala", "Kouvola")).toBe(false)
  })
})
