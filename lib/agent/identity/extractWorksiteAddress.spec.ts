import { describe, it, expect } from "vitest"
import { extractWorksiteDeterministic } from "./extractWorksiteAddress"

describe("extractWorksiteDeterministic", () => {
  it("poimii osoitteen ja kaupungin vakiomuotoisesta kuvauksesta", () => {
    const desc =
      "Turun yliopiston kasvitieteellisen puutarhan rakennuspaikka sijaitsee " +
      "osoitteessa: Ruissalon puistotie 215, 20100 Turku. Talotekniikka uusitaan."
    const r = extractWorksiteDeterministic(desc)
    expect(r.city).toBe("Turku")
    expect(r.address).toBe("Ruissalon puistotie 215, 20100 Turku")
  })

  it("poimii kaupungin pelkästä postinumero+kaupunki -maininnasta (ei katua)", () => {
    const r = extractWorksiteDeterministic("Kohde sijaitsee 33100 Tampere alueella.")
    expect(r.city).toBe("Tampere")
    expect(r.address).toBeNull()
  })

  it("ei keksi kaupunkia kun sitä ei mainita", () => {
    const r = extractWorksiteDeterministic("Yleinen kuvaus ilman osoitetta.")
    expect(r.city).toBeNull()
    expect(r.address).toBeNull()
  })

  it("ei hyväksy postinumeron perässä olevaa ei-kuntaa (esim. organisaatio)", () => {
    // "20014 Turun yliopisto" — "Turun" ei ole kunta -> ei osumaa
    const r = extractWorksiteDeterministic("Yliopistonmäki 20014 Turun yliopisto FIN")
    expect(r.city).toBeNull()
  })

  it("sietää tyhjän syötteen", () => {
    expect(extractWorksiteDeterministic(null)).toEqual({ city: null, address: null })
    expect(extractWorksiteDeterministic("")).toEqual({ city: null, address: null })
  })
})
