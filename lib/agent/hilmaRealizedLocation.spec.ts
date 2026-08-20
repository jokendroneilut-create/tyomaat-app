import { describe, it, expect } from "vitest"
import { parseRealizedLocation, isPostBoxOnly } from "./hilmaRealizedLocation"

const lot = (address: any) => ({
  procurementProjectLot: [{ procurementProject: { realizedLocation: [{ address }] } }],
})

describe("parseRealizedLocation", () => {
  it("poimii katuosoitteen ja kaupungin", () => {
    expect(
      parseRealizedLocation(
        lot({
          streetName: { value: "Taipalsaarentie 476" },
          postalZone: { value: "53100" },
          cityName: { value: "Lappeenranta" },
        })
      )
    ).toEqual({ address: "Taipalsaarentie 476, 53100 Lappeenranta", city: "Lappeenranta" })
  })

  /*
   * Isonkyrön latukonehalli 21.8.2026: tilaaja jätti suorituspaikan
   * täyttämättä, jolloin kenttään jää koodi "missä tahansa maassa".
   */
  it("hylkää anyw-cou-merkinnän", () => {
    expect(parseRealizedLocation(lot({ region: { value: "anyw-cou" } }))).toEqual({
      address: null,
      city: null,
    })
  })

  it("ei tee osoitetta pelkästä kaupungista", () => {
    expect(parseRealizedLocation(lot({ cityName: { value: "Vaasa" } }))).toEqual({
      address: null,
      city: "Vaasa",
    })
  })

  /*
   * Kaksi eri työmaata ei mahdu yhdelle ehdokasriville, joten osoite
   * jätetään mieluummin tyhjäksi kuin arvataan kumpi niistä on oikea.
   */
  it("jättää osoitteen tyhjäksi kun osilla on eri työmaat", () => {
    const eForm = {
      procurementProjectLot: [
        { procurementProject: { realizedLocation: [{ address: { streetName: { value: "Kuja 1" }, cityName: { value: "Espoo" } } }] } },
        { procurementProject: { realizedLocation: [{ address: { streetName: { value: "Tie 9" }, cityName: { value: "Espoo" } } }] } },
      ],
    }
    expect(parseRealizedLocation(eForm)).toEqual({ address: null, city: "Espoo" })
  })

  it("sallii saman osoitteen toistumisen useassa osassa", () => {
    const one = { address: { streetName: { value: "Vallinmäentie 43" }, cityName: { value: "Laihia" } } }
    const eForm = {
      procurementProjectLot: [
        { procurementProject: { realizedLocation: [one] } },
        { procurementProject: { realizedLocation: [one] } },
      ],
    }
    expect(parseRealizedLocation(eForm).address).toBe("Vallinmäentie 43, Laihia")
  })

  it("lukee myös hanketason sijainnin ilman osia", () => {
    expect(
      parseRealizedLocation({
        procurementProject: { realizedLocation: [{ address: { streetName: { value: "Tasasentie 9" }, cityName: { value: "Keminmaa" } } }] },
      }).address
    ).toBe("Tasasentie 9, Keminmaa")
  })

  /*
   * Päällystysurakka 594051 (21.8.2026): tilaaja oli merkinnyt
   * suorituspaikaksi oman postilokeronsa. Se ei ole työmaan osoite.
   */
  it("ei ota pelkkää postilokeroa osoitteeksi", () => {
    expect(
      parseRealizedLocation(
        lot({ streetName: { value: "PL 125" }, postalZone: { value: "76100" }, cityName: { value: "Pieksämäki" } })
      )
    ).toEqual({ address: null, city: "Pieksämäki" })
  })

  it("hyväksyy kadun jonka perässä on postilokero", () => {
    expect(
      parseRealizedLocation(
        lot({ streetName: { value: "Rasintie 1A, PL 25" }, postalZone: { value: "64700" }, cityName: { value: "Teuva" } })
      ).address
    ).toBe("Rasintie 1A, PL 25, 64700 Teuva")
  })

  /* Iniön kirkko: postinumeroksi oli kirjoitettu kuusinumeroinen "123390". */
  it("jättää virheellisen postinumeron pois", () => {
    expect(
      parseRealizedLocation(
        lot({ streetName: { value: "Kommunhusbacken" }, postalZone: { value: "123390" }, cityName: { value: "Parainen" } })
      ).address
    ).toBe("Kommunhusbacken, Parainen")
  })

  it("tunnistaa postilokeron eri kirjoitusasuissa", () => {
    expect(isPostBoxOnly("PL 125")).toBe(true)
    expect(isPostBoxOnly("pl. 3")).toBe(true)
    expect(isPostBoxOnly("P.L. 41")).toBe(true)
    expect(isPostBoxOnly("Plassintie 4")).toBe(false)
  })

  it("kestää puuttuvan rakenteen", () => {
    expect(parseRealizedLocation(null)).toEqual({ address: null, city: null })
    expect(parseRealizedLocation({})).toEqual({ address: null, city: null })
  })
})
