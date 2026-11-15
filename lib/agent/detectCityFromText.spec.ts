import { describe, it, expect } from "vitest"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Kaikki tapaukset ovat mitattuja: 283 rivillä kaupunki oli tullut
 * lähteestä, ja 11.10.2026 niistä 49:llä tekstintunnistus sanoi eri.
 * Kahdeksan kymmenestä sanoi "Helsinki" (D-267).
 */
describe("detectCityFromText", () => {
  it("valitsee ensimmäisen tekstissä, ei ensimmäisen taulukossa", () => {
    // Taulukossa Helsinki on ensimmäinen, tekstissä Kajaani.
    expect(
      detectCityFromText("Datakeskus Kajaaniin. Rakentaja toimii Helsingissä.")
    ).toBe("Kajaani")
  })

  it("ei anna julkaisijan kotipaikan voittaa hankkeen sijaintia", () => {
    expect(
      detectCityFromText(
        "Rovaniemen uusi pääpoliisiasema valmistuu 2028. SRV Yhtiöt Oyj on " +
          "helsinkiläinen rakennusyhtiö, kotipaikka Helsinki."
      )
    ).toBe("Rovaniemi")
  })

  it("ohittaa lainausmerkeissä olevan nimen", () => {
    // Melkinlaiturin kilpailun voitti ehdotus "Luoto"; hanke on Helsingissä.
    expect(
      detectCityFromText(
        "Inaro valittiin jatkosuunnittelijaksi ehdotuksella ”Luoto”. " +
          "Kohde sijaitsee Helsingin Jätkäsaaressa."
      )
    ).toBe("Helsinki")
  })

  it("vaatii kantaosumalle sijapäätteen", () => {
    // "Nurme 2 ja 4" on virolainen hankenimi, ei Nurmes.
    expect(
      detectCityFromText("Nurme 2 ja 4, Keila kortermaja, Tallinna, Viro")
    ).not.toBe("Nurmes")
  })

  it("tunnistaa Paraisten nen-s-taivutuksen", () => {
    expect(
      detectCityFromText("Asuntokohde Norra Famnen -kortteliin Paraisille")
    ).toBe("Parainen")
  })

  it("lukee järvennimen järveksi eikä kunnaksi", () => {
    expect(
      detectCityFromText(
        "Pysäköintitalo nousee Hatanpäälle Pyhäjärven rantamaisemaan Tampereella."
      )
    ).toBe("Tampere")
  })

  it("jättää kunnan tyhjäksi jos vain järvi mainitaan", () => {
    expect(detectCityFromText("Kohde nousee Pyhäjärven rantaan.")).toBeNull()
  })

  it("ei lue yhdyssanan sisältä (Espoonlahti ei ole Lahti)", () => {
    expect(detectCityFromText("Uusi koulu Espoonlahteen")).not.toBe("Lahti")
  })
})

/*
 * TAIVUTUSMUODOT JOISSA VARTALO MUUTTUU (D-322). Mitattu 19.10.2026
 * kahdeksallatoista muodolla; nama nelja pettivat.
 */
describe("detectCityFromText: vartalon muuttavat muodot", () => {
  it("tunnistaa Seinäjoen ja Rovaniemen k:n kadotessa", () => {
    expect(detectCityFromText("rakennamme seinäjoelle uuden kohteen")).toBe("Seinäjoki")
    expect(detectCityFromText("kohde seinäjoella valmistuu")).toBe("Seinäjoki")
    expect(detectCityFromText("rakennamme rovaniemelle hoivakodin")).toBe("Rovaniemi")
  })

  it("tunnistaa Nurmeksen s -> kse -vaihtelun", () => {
    expect(detectCityFromText("rakennamme nurmekseen päiväkodin")).toBe("Nurmes")
    expect(detectCityFromText("kohde nurmeksessa")).toBe("Nurmes")
  })

  it("tunnistaa pitkään vokaaliin päättyvän nimen illatiivin", () => {
    expect(detectCityFromText("rakennamme joensuuhun palveluasumisyksikön")).toBe("Joensuu")
  })

  /*
   * D-424: astevaihtelu yleissääntönä -joki, -mäki ja -lahti -kunnille.
   * Rakennuslehden "Pyhäjoen kunnantalo rakennetaan hirrestä" jäi ilman
   * kuntaa 15.11.2026.
   */
  it("tunnistaa -joki, -mäki ja -lahti -kunnat heikossa asteessa", () => {
    expect(detectCityFromText("Pyhäjoen kunnantalo rakennetaan hirrestä")).toBe("Pyhäjoki")
    expect(detectCityFromText("Pyhäjoella on kehitetty hirsirakentamista")).toBe("Pyhäjoki")
    expect(detectCityFromText("Kärsämäen yleiskaavan päivitys")).toBe("Kärsämäki")
    expect(detectCityFromText("Kylmäojan koulun piha, Kontiolahden kunta")).toBe("Kontiolahti")
    expect(detectCityFromText("Vt4 Utsjoen sillat")).toBe("Utsjoki")
    expect(detectCityFromText("Vihdin kirkonkylän liikekeskus")).toBe("Vihti")
  })

  it("joki ei ole kunta kun perässä on jokisana tai toinen joki", () => {
    expect(detectCityFromText("satama Kalajoen suulla")).toBeNull()
    expect(detectCityFromText("Siikajoen ja Lamujoen rantasuojausten rakentaminen, Siikalatva")).toBe("Siikalatva")
  })

  it("Lapinlahti ei tule Helsingin Lapinlahden sairaalasta", () => {
    expect(detectCityFromText("Lapinlahden sairaala-alueen rantamuurin peruskorjaus")).toBeNull()
  })
})
