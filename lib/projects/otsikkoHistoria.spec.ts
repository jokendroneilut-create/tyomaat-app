import { describe, expect, it } from "vitest"

import { sailytaVanhaOtsikko } from "./otsikkoHistoria"

describe("sailytaVanhaOtsikko", () => {
  it("tallentaa ensimmaisen nimen lahteen otsikoksi", () => {
    expect(
      sailytaVanhaOtsikko({
        vanhaNimi: "Are sai viiden miljoonan talotekniikkaurakan kouluhankkeesta",
        uusiNimi: "Halkokarin koulu ja paivakoti, Kokkola",
        metadata: {},
      })
    ).toEqual({
      source_title: "Are sai viiden miljoonan talotekniikkaurakan kouluhankkeesta",
    })
  })

  /*
   * Lahteen otsikko sailyy erillaan: toinen nimeaminen ei saa ylikirjoittaa
   * sita, vaan menee tyonimien listaan.
   */
  it("siirtaa myohemmat nimet also_known_as-listaan", () => {
    expect(
      sailytaVanhaOtsikko({
        vanhaNimi: "Halkokarin koulu",
        uusiNimi: "Halkokarin koulu ja paivakoti, Kokkola",
        metadata: { source_title: "Are sai viiden miljoonan talotekniikkaurakan" },
      })
    ).toEqual({ also_known_as: ["Halkokarin koulu"] })
  })

  it("sailyttaa aiemmat tyonimet", () => {
    expect(
      sailytaVanhaOtsikko({
        vanhaNimi: "Kolmas nimi",
        uusiNimi: "Neljas nimi",
        metadata: { source_title: "Lahteen otsikko", also_known_as: ["Toinen nimi"] },
      })
    ).toEqual({ also_known_as: ["Toinen nimi", "Kolmas nimi"] })
  })

  it("ei kahdenna samaa nimea", () => {
    expect(
      sailytaVanhaOtsikko({
        vanhaNimi: "Toinen nimi",
        uusiNimi: "Kolmas nimi",
        metadata: { source_title: "Lahteen otsikko", also_known_as: ["Toinen nimi"] },
      })
    ).toEqual({})
  })

  it("ei tee mitaan jos nimi ei muutu", () => {
    expect(
      sailytaVanhaOtsikko({ vanhaNimi: "Sama", uusiNimi: "Sama", metadata: {} })
    ).toEqual({})
  })

  it("ei tee mitaan jos vanha tai uusi nimi puuttuu", () => {
    expect(sailytaVanhaOtsikko({ vanhaNimi: null, uusiNimi: "Uusi", metadata: {} })).toEqual({})
    expect(sailytaVanhaOtsikko({ vanhaNimi: "Vanha", uusiNimi: "", metadata: {} })).toEqual({})
  })

  it("ei kirjaa uudelleen jos vanha nimi on jo lahteen otsikkona", () => {
    expect(
      sailytaVanhaOtsikko({
        vanhaNimi: "Lahteen otsikko",
        uusiNimi: "Uusi nimi",
        metadata: { source_title: "Lahteen otsikko" },
      })
    ).toEqual({})
  })
})
