import { describe, expect, it } from "vitest"

import { kuntaHankkeesta, kunnatTekstista, onAlueellinenPaketti } from "./kuntaHankkeesta"

/*
 * Jokainen tapaus on luettu kannasta 8.11.2026 (D-395): nämä 98 riviä
 * olivat ilman kuntaa, ja sääntö kirjoitettiin niiden yli ajetun
 * kuivaharjoituksen perusteella. Väärät osumat ovat mukana
 * kieltotesteinä, koska ne olisi kirjoitettu kantaan ilman sääntöä.
 */
describe("kuntaHankkeesta", () => {
  it("lukee kunnan hankkeen nimestä", () => {
    expect(
      kuntaHankkeesta({
        name: "Valtatien 10 kääntö valtatielle 9 Liedon kohdalla",
        region: "Varsinais-Suomi",
      })
    ).toEqual({ kunta: "Lieto", peruste: "nimi" })

    expect(
      kuntaHankkeesta({
        name: "Riihimäen keskustan S-marketin rakentaminen käynnistyy",
        region: "Kanta-Häme",
      })
    ).toEqual({ kunta: "Riihimäki", peruste: "nimi" })
  })

  it("lukee kunnan kuvauksen sijaintilauseesta", () => {
    expect(
      kuntaHankkeesta({
        name: "Merven raiteen ratasuunnitelma",
        description:
          "Hankkeen tausta ja sisältö Hattulan kunnan alueella sijaitseva Merven raide on noin kaksi kilometriä pitkä raide, joka on rakennettu 1980-luvulla.",
        region: "Kanta-Häme",
      })
    ).toEqual({ kunta: "Hattula", peruste: "kuvaus" })

    expect(
      kuntaHankkeesta({
        name: "Jorvaksen aseman parantaminen",
        description:
          "Jorvaksen liikennepaikka sijaitsee Rantaradalla Kirkkonummella ja se palvelee pääasiassa lähiliikennettä.",
        region: "Uusimaa",
      })
    ).toEqual({ kunta: "Kirkkonummi", peruste: "kuvaus" })
  })

  it("ei paattele kuntaa kun toinen kunta on samassa ikkunassa", () => {
    /*
     * MITATTU HARJAVALTA: oikea kunta jaa poimimatta, koska toinen
     * virke mainitsee Tampereen ja Porin ("Kaikki Tampere-Pori-valin
     * junat pysahtyvat Harjavallassa"). Tyhja on silti parempi kuin
     * vaara -- ja "Harjavallan" ei osu nimihakuun lainkaan, koska
     * astevaihtelu (lt -> ll) ei ole kannassa.
     */
    expect(
      kuntaHankkeesta({
        name: "Harjavallan ratapihalaajennus",
        description:
          "Lähtötilanne Harjavalta palvelee liikennepaikkana sekä matkustaja- että tavaraliikennettä. Kaikki Tampere–Pori-välin junat pysähtyvät Harjavallassa.",
        region: "Satakunta",
      })
    ).toBeNull()
  })

  it("lukee sijaintilauseen vaikka seuraava virke mainitsee muita kuntia", () => {
    /*
     * MERVEN RAIDE KOKONAISUUDESSAAN. Kahden virkkeen yhteinen ikkuna
     * hylkasi taman rivin, koska toinen virke mainitsee Helsingin ja
     * Tampereen -- eli saanto hylkasi oman esimerkkinsa. Virke
     * kerrallaan se toimii.
     */
    expect(
      kuntaHankkeesta({
        name: "Merven raiteen ratasuunnitelma",
        description:
          "Hankkeen tausta ja sisältö Hattulan kunnan alueella sijaitseva Merven raide on noin kaksi kilometriä pitkä raide, joka on rakennettu 1980-luvulla. Raide erkanee Helsinki Tampere pääradalla olevalta Parolan ratapihalta ja siitä käytetään joissakin yhteyksissä myös nimeä Parolan pistoraide.",
        region: "Kanta-Häme",
      })
    ).toEqual({ kunta: "Hattula", peruste: "kuvaus" })
  })

  it("lukee sijaintilauseen myos toisesta virkkeesta", () => {
    /* Jyvaskyla: ensimmaisessa virkkeessa ei ole kuntaa lainkaan. */
    expect(
      kuntaHankkeesta({
        name: "Mt 16623 Keljonkankaantien jalankulku- ja pyöräilyväylä",
        description:
          "Suunnittelun tarkoituksena oli laatia katu- ja rakentamissuunnitelmat jalankulku- ja pyöräilyväylästä Keljonkankaantielle. Suunnittelukohde sijoittuu Jyväskylän kaupungin alueelle.",
        region: "Keski-Suomi",
      })
    ).toEqual({ kunta: "Jyväskylä", peruste: "kuvaus" })
  })

  it("ei paattele kuntaa alueelliselle paketille", () => {
    /* 25 rivia 98:sta oli tallaisia. */
    for (const nimi of [
      "Siltatyöt Kainuussa",
      "Päällystystyöt 2026 - Satakunta",
      "Putkisiltaurakka 2026 - Itä-Suomi",
      "LOU maanteiden kuivatusurakka 2026 (-2028)",
      "TIETOPYYNTÖ - Urakoiden puitesopimusjärjestelyt",
    ]) {
      expect(onAlueellinenPaketti(nimi), nimi).toBe(true)
      expect(kuntaHankkeesta({ name: nimi, description: "Urakka sijaitsee alueella." })).toBeNull()
    }
  })

  it("ei paattele kuntaa kun lauseessa on kaksi kuntaa", () => {
    /* Vt 11 Koiviston ja Pikkuhaaran sillat: Pori JA Ulvila. */
    expect(
      kuntaHankkeesta({
        name: "Vt 11 Koiviston ja Pikkuhaaran sillat",
        description:
          "Koiviston ja Pikkuhaaran sillat sijaitsevat valtatiellä 11 Porin ja Ulvilan kaupunkien alueella.",
        region: "Satakunta",
      })
    ).toBeNull()

    expect(
      kuntaHankkeesta({
        name: "Kt 51 parantaminen välillä Sunnanvik-Munkinmäki",
        description:
          "Uudenmaan elinvoimakeskus laatii kantatien 51 parantamisen yleissuunnitelmaa välille Sunnanvik–Munkinmäki, Siuntio ja Kirkkonummi.",
        region: "Uusimaa",
      })
    ).toBeNull()
  })

  it("ei lue kuntaa rataosuudesta eika asemalistasta", () => {
    /*
     * Nama kaksi olisi kirjoitettu kantaan vaarin ilman
     * sijaintilause- ja kaksoiskuntasaantoa.
     */
    expect(
      kuntaHankkeesta({
        name: "Rantaradan kehittäminen Karjaa-Kauklahti",
        description:
          "Rantarata kulkee Helsingin ja Turun välillä, ja sen liikenne on pääosin kaukojunaliikennettä.",
        region: "Uusimaa",
      })
    ).toBeNull()

    expect(
      kuntaHankkeesta({
        name: "Jokelan asema",
        description:
          "Kesän ja syksyn rakennustyöt aiheuttavat muutoksia käytössä oleviin laitureihin Järvenpään, Saunakallion ja Jokelan asemilla.",
        region: "Uusimaa",
      })
    ).toBeNull()
  })

  it("ei lue kuntaa kahden kohteen otsikosta", () => {
    /*
     * "Koiviston ja Pikkuhaaran sillat" on kohdelista, ei kunta.
     * Jos kohteet osoittavat samaan kuntaan, nimiosuma kelpaa yha.
     */
    expect(
      kuntaHankkeesta({
        name: "Vt 11 Koiviston ja Pikkuhaaran sillat, Pori",
        region: "Satakunta",
      })
    ).toBeNull()
  })

  it("hylkaa kunnan joka ei ole hankkeen maakunnassa", () => {
    expect(
      kuntaHankkeesta({
        name: "Toivalan ylikulkusilta",
        description: "Silta sijaitsee Polvijärvellä.",
        region: "Keski-Suomi",
      })
    ).toBeNull()
  })

  it("loytaa useamman kunnan samasta tekstista", () => {
    expect(kunnatTekstista("sillat sijaitsevat Porin ja Ulvilan alueella")).toEqual(["Pori", "Ulvila"])
    expect(kunnatTekstista("Hattulan kunnan alueella")).toEqual(["Hattula"])
  })
})
