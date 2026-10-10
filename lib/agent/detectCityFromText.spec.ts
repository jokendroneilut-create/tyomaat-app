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
