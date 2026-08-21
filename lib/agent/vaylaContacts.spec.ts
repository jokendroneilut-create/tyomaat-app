import { describe, expect, it } from "vitest"

import { expandPlaceholderEmail, isPersonName, normalizeVaylaContact } from "./vaylaContacts"

describe("isPersonName", () => {
  it("hyväksyy tavallisen nimen", () => {
    expect(isPersonName("Kari Partiainen")).toBe(true)
    expect(isPersonName("Vesa-Matti Eura")).toBe(true)
  })

  it("hylkää ohjetekstin nimikentässä", () => {
    /* Nämä ovat todellisia arvoja Väyläviraston sivujen full-name-kentässä. */
    expect(isPersonName("Yhteydenotot Palauteväylän kautta (palautevayla.fi)")).toBe(false)
    expect(isPersonName("Kts. osahankkeiden yhteystiedot")).toBe(false)
  })

  it("hylkää yhden sanan ja liian pitkän", () => {
    expect(isPersonName("Väylävirasto")).toBe(false)
    expect(isPersonName("Anna Maria Liisa Virtanen")).toBe(false)
  })
})

describe("expandPlaceholderEmail", () => {
  it("laajentaa mallin nimen perusteella", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@vayla.fi", "Kari Partiainen")).toBe(
      "kari.partiainen@vayla.fi"
    )
  })

  it("riisuu ääkköset mutta säilyttää väliviivan", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@elinvoimakeskus.fi", "Timo Bäcklund")).toBe(
      "timo.backlund@elinvoimakeskus.fi"
    )
    expect(expandPlaceholderEmail("etunimi.sukunimi@elinvoimakeskus.fi", "Vesa-Matti Eura")).toBe(
      "vesa-matti.eura@elinvoimakeskus.fi"
    )
  })

  it("palauttaa oikean osoitteen sellaisenaan", () => {
    expect(expandPlaceholderEmail("maria.torttila@vayla.fi", "Maria Torttila")).toBe(
      "maria.torttila@vayla.fi"
    )
  })

  it("hylkää tunnistamattoman mallin", () => {
    /*
     * Sivulla ollut kirjoitusvirhe. Ensimmäinen versio palautti tämän
     * sellaisenaan, jolloin asiakkaalle olisi näytetty osoite
     * "etunimi.sukuni@vayla.fi".
     */
    expect(expandPlaceholderEmail("etunimi.sukuni@vayla.fi", "Vesa Pakarinen")).toBeNull()
  })

  it("ei laajenna kun nimi ei ole henkilö", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@rovaniemi.fi", "Lapin Kansa")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@rovaniemi.fi", "Tekninen lautakunta")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@vykos.fi", "Vykos Oy")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@tuusula.fi", "Valmistelija Sahlakari")).toBeNull()
    expect(expandPlaceholderEmail("fornamn.efternamn@korsnas.fi", "Fornamn Efternamn")).toBeNull()
  })
})

describe("normalizeVaylaContact", () => {
  it("poimii henkilön ja laajentaa osoitteen", () => {
    expect(
      normalizeVaylaContact({
        organization: "Väylävirasto",
        title: "Projektipäällikkö",
        name: "Kari Partiainen",
        phone: "029 534 3580",
        email: "etunimi.sukunimi@vayla.fi",
      })
    ).toEqual([
      {
        name: "Kari Partiainen",
        title: "Projektipäällikkö",
        organization: "Väylävirasto",
        email: "kari.partiainen@vayla.fi",
        phone: "029 534 3580",
        kind: "person",
      },
    ])
  })

  it("säilyttää nimen ja puhelimen vaikka osoite hylätään", () => {
    const [c] = normalizeVaylaContact({
      organization: "Väylävirasto",
      title: "Projektipäällikkö",
      name: "Vesa Pakarinen",
      phone: "029 534 3149",
      email: "etunimi.sukuni@vayla.fi",
    })

    expect(c.name).toBe("Vesa Pakarinen")
    expect(c.phone).toBe("029 534 3149")
    expect(c.email).toBe("")
  })

  it("siistii versaalinimikkeen", () => {
    expect(normalizeVaylaContact({
      organization: null,
      title: "PROJEKTIPÄÄLLIKKÖ",
      name: "Petri Teerimäki",
      phone: "0295 024 008",
      email: null,
    })[0].title).toBe("Projektipäällikkö")
  })

  it("palauttaa tyhjän kun nimikentässä on ohje", () => {
    expect(
      normalizeVaylaContact({
        organization: null,
        title: null,
        name: "Kts. osahankkeiden yhteystiedot",
        phone: "029 534 3000",
        email: null,
      })
    ).toEqual([])
  })

  it("palauttaa tyhjän kun jäljelle jäisi pelkkä nimi", () => {
    expect(
      normalizeVaylaContact({ organization: null, title: null, name: "Kari Partiainen", phone: null, email: null })
    ).toEqual([])
  })
})
