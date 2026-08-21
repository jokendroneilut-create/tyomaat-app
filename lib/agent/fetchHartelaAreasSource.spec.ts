import { describe, it, expect } from "vitest"
import {
  cityFromHartelaHeading,
  projectNameFromHeadings,
  hartelaDescription,
  residentialTypeOnly,
} from "./fetchHartelaAreasSource"

describe("cityFromHartelaHeading", () => {
  /*
   * Otsikon järjestys vaihtelee sivulta toiselle. Pelkkä pilkkua edeltävä
   * osa antoi kunnan vain 7 sivulta 15:stä (mitattu 19.8.2026).
   */
  it("löytää kunnan otsikon kummalta puolelta tahansa", () => {
    expect(cityFromHartelaHeading("Kirkkonummi, Sarvvik")).toBe("Kirkkonummi")
    expect(cityFromHartelaHeading("Lauttasaari, Helsinki")).toBe("Helsinki")
  })

  /*
   * Lyhyet kunnat vaativat kaupunkitunnistimessa taivutuspäätteen, joten
   * pelkkä "Oulu" ei tunnistu. Otsikon osa on kuitenkin kokonaisuudessaan
   * kunnan nimi, joten suora vertailu kuntaluetteloon on turvallinen.
   */
  it("tunnistaa lyhyen kunnan ilman taivutuspäätettä", () => {
    expect(cityFromHartelaHeading("Oulu, Karjasillan Kulma")).toBe("Oulu")
  })

  it("tunnistaa taivutetun muodon ilman pilkkua", () => {
    expect(cityFromHartelaHeading("Nokian Keskusta")).toBe("Nokia")
  })

  it("palauttaa nullin kun kuntaa ei ole", () => {
    expect(cityFromHartelaHeading("Tulevat asuinalueet")).toBeNull()
  })
})

describe("projectNameFromHeadings", () => {
  /*
   * Sivun h1 on "Kirkkonummi, Sarvvik" eli kaupunki ja kaupunginosa — se ei
   * yksilöi hanketta. Taloyhtiön nimi on omana väliotsikkonaan.
   */
  it("käyttää taloyhtiön nimeä kun se löytyy", () => {
    expect(
      projectNameFromHeadings(
        ["Kaupunkikoti saaristomäntyjen kupeessa", "Asunto Oy Sarvvikin Ukonkello Kirkkonummi"],
        "Kirkkonummi, Sarvvik"
      )
    ).toBe("Asunto Oy Sarvvikin Ukonkello Kirkkonummi")
  })

  it("palaa otsikkoon kun taloyhtiötä ei mainita", () => {
    expect(
      projectNameFromHeadings(["Kolme syytä muuttaa Lentävänniemeen"], "Tampere, Lentävänniemi")
    ).toBe("Tampere, Lentävänniemi")
  })
})

describe("hartelaDescription", () => {
  /*
   * Mitattu 21.8.2026: kaikki 15 ehdokasta alkoivat selainkehotuksella,
   * koska trim() ajettiin vasta poiston jalkeen eika "^Ole hyva" osunut.
   */
  it("poistaa selainkehotuksen ja pikavalikon", () => {
    const body =
      "  Ole hyvä ja päivitä selaimesi uudempaan versioon. Pikavalikko palvelut ja liikenneyhteydet Suunnittelemme uusia koteja Liedon Loukinaisiin."
    expect(hartelaDescription(body)).toBe(
      "Suunnittelemme uusia koteja Liedon Loukinaisiin."
    )
  })

  /*
   * Sivun alku markkinoi KAUPUNKIA. Sielta luettuna kuvaus on hyodyton ja
   * rakennustyypiksi tuli "Paivakoti" kuudelle hankkeelle.
   */
  it("ohittaa kaupungin markkinointitekstin ja aloittaa hankkeesta", () => {
    const body =
      "Nokia tarjoaa kattavan palveluverkoston. Päiväkodit, koulut ja lukio luovat pohjan. Poutuntien varrelle on suunnitteilla uusi asuinkerrostalo."
    expect(hartelaDescription(body)).toBe(
      "Poutuntien varrelle on suunnitteilla uusi asuinkerrostalo."
    )
  })

  /*
   * Pelkka verbi ei riita: "arki rakentuu palveluiden ymparille" on
   * tunnelmointia. Virkkeessa on oltava myos asumiseen viittaava sana.
   */
  it("ei aloita virkkeesta jossa on verbi mutta ei asumista", () => {
    const body =
      "Vanttilassa arki rakentuu lähellä olevien palveluiden ympärille. Hyttipojankuja 2 on suunnitteilla oleva kerrostalo."
    expect(hartelaDescription(body)).toBe(
      "Hyttipojankuja 2 on suunnitteilla oleva kerrostalo."
    )
  })

  it("palauttaa siivotun tekstin kun hankeosuutta ei loydy", () => {
    expect(hartelaDescription("Pikavalikko Tervetuloa alueelle.")).toBe(
      "Tervetuloa alueelle."
    )
  })
})

describe("residentialTypeOnly", () => {
  /*
   * Sivusto on "tulevat asuinalueet", joten paivakoti on aina
   * vaarinluettu kaupungin palveluluettelosta.
   */
  it("hylkaa ei-asuintyypit", () => {
    expect(residentialTypeOnly("Päiväkoti")).toBeNull()
    expect(residentialTypeOnly("Koulu")).toBeNull()
    expect(residentialTypeOnly("Liikuntapaikka")).toBeNull()
  })

  it("sallii asuintyypit", () => {
    expect(residentialTypeOnly("Kerrostalo")).toBe("Kerrostalo")
    expect(residentialTypeOnly("Rivitalo")).toBe("Rivitalo")
  })

  it("kestaa tyhjan", () => {
    expect(residentialTypeOnly(null)).toBeNull()
  })
})
