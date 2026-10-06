import { describe, expect, it } from "vitest"

import { helsinginYhteyshenkilot } from "./helsinginLisatiedot"

/* Oikeaa tekstia paatokset.hel.fi-sivulta 6.10.2026. */
const SIVU =
  "Sulje alue: Muutoksenhaku Sulje Päättäjä Nimi Rikhard Manninen Titteli Maankäyttöjohtaja " +
  "Lisätietojen antaja Nimi Katariina Verkamo Titteli Projektinjohtaja " +
  "Puhelinnumero 09 310 20706(Linkki aloittaa puhelun) " +
  "Sähköposti katariina.verkamo@hel.fi(Linkki avaa oletussähköpostiohjelman)"

describe("helsinginYhteyshenkilot", () => {
  it("poimii nimen, nimikkeen, puhelimen ja sahkopostin", () => {
    const loydot = helsinginYhteyshenkilot(SIVU)
    expect(loydot).toHaveLength(1)
    expect(loydot[0]).toEqual({
      nimi: "Katariina Verkamo",
      nimike: "Projektinjohtaja",
      puhelin: "09 310 20706",
      sahkoposti: "katariina.verkamo@hel.fi",
    })
  })

  /*
   * PAATTAJA EI OLE YHTEYSHENKILO. Maankayttojohtaja hyvaksyy
   * suunnitelman; projektipaallikko tekee hanketta.
   */
  it("ei poimi paattajaa", () => {
    const nimet = helsinginYhteyshenkilot(SIVU).map((l) => l.nimi)
    expect(nimet).not.toContain("Rikhard Manninen")
  })

  it("poimii useita lisatietojen antajia", () => {
    const sivu =
      "Lisätietojen antaja Nimi Susanna Hyvärinen Titteli Projektipäällikkö " +
      "Puhelinnumero 09 310 60716(Linkki aloittaa puhelun) Sähköposti susanna.hyvarinen@hel.fi(Linkki) " +
      "Lisätietojen antaja Nimi Lasse Toivanen Titteli Yksikön päällikkö " +
      "Puhelinnumero 09 310 39343(Linkki aloittaa puhelun) Sähköposti lasse.toivanen@hel.fi(Linkki)"
    const loydot = helsinginYhteyshenkilot(sivu)
    expect(loydot.map((l) => l.nimi)).toEqual(["Susanna Hyvärinen", "Lasse Toivanen"])
    expect(loydot[1].puhelin).toBe("09 310 39343")
  })

  /* Sama henkilo esiintyy osalla sivuista kahdesti. */
  it("ei toista samaa henkiloa", () => {
    const sivu =
      "Lisätietojen antaja Nimi Camilla Lindroth Titteli Arkkitehti Sähköposti camilla.lindroth@hel.fi(L) " +
      "Lisätietojen antaja Nimi Camilla Lindroth Titteli Arkkitehti Sähköposti camilla.lindroth@hel.fi(L)"
    expect(helsinginYhteyshenkilot(sivu)).toHaveLength(1)
  })

  /*
   * Helsinki on kaksikielinen, ja ruotsinkielinen sivu on tavallinen
   * tapaus eika poikkeus: kuivaharjoituksessa 25 sivusta 3 jai ilman ja
   * kaksi niista oli ruotsiksi.
   */
  it("lukee ruotsinkielisen sivun", () => {
    const sivu =
      "Mer information Namn Maria Nelskylä Titel Stadssekreterare " +
      "Telefonnummer 09 310 25251(Link startar ett telefonsamtal) " +
      "E-post maria.nelskyla@hel.fi(Länk öppnar standardprogram för e-post) Ladda ner utskriftsversion"
    expect(helsinginYhteyshenkilot(sivu)).toEqual([
      {
        nimi: "Maria Nelskylä",
        nimike: "Stadssekreterare",
        puhelin: "09 310 25251",
        sahkoposti: "maria.nelskyla@hel.fi",
      },
    ])
  })

  /* Sama henkilo molemmilla kielilla samalla sivulla on yksi henkilo. */
  it("ei toista samaa henkiloa kahdella kielella", () => {
    const sivu =
      "Lisätietojen antaja Nimi Susanna Hyvärinen Titteli Kaupunginsihteeri Sähköposti susanna.hyvarinen@hel.fi(L) " +
      "Mer information Namn Susanna Hyvärinen Titel Stadssekreterare E-post susanna.hyvarinen@hel.fi(L)"
    expect(helsinginYhteyshenkilot(sivu)).toHaveLength(1)
  })

  it("sietaa puuttuvan osion ja tyhjan", () => {
    expect(helsinginYhteyshenkilot("Päättäjä Nimi Rikhard Manninen")).toEqual([])
    expect(helsinginYhteyshenkilot("")).toEqual([])
    expect(helsinginYhteyshenkilot(null)).toEqual([])
  })
})
