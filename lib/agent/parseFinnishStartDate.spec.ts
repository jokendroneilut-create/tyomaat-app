import { describe, expect, it } from "vitest"

import { parseFinnishStartDate } from "./parseFinnishStartDate"

describe("parseFinnishStartDate", () => {
  it("lukee kuukauden ja vuoden, myös menneessä muodossa", () => {
    expect(parseFinnishStartDate("Monitoimitalon rakennustyöt alkavat toukokuussa 2026.")?.paiva).toBe(
      "2026-05-01"
    )
    expect(parseFinnishStartDate("Rakentaminen käynnistyi tammikuussa 2025.")?.paiva).toBe("2025-01-01")
    expect(parseFinnishStartDate("Purkutyöt aloitetaan syyskuussa 2027.")?.paiva).toBe("2027-09-01")
  })

  it("lukee tarkan päivän kun se on kerrottu", () => {
    const t = parseFinnishStartDate("Työmaa käynnistyy 1.3.2026 ja kestää vuoden.")
    expect(t?.paiva).toBe("2026-03-01")
    expect(t?.tarkkuus).toBe("paiva")
  })

  it("lukee urakka-ajan alkukuukauden", () => {
    expect(parseFinnishStartDate("Hanke urakoidaan ajanjaksolla 04-09/2026.")?.paiva).toBe("2026-04-01")
    expect(parseFinnishStartDate("Urakka-aika 9/2026-12/2027.")?.paiva).toBe("2026-09-01")
  })

  it("ei lue valmistumista aloitukseksi", () => {
    expect(parseFinnishStartDate("Kohde valmistuu toukokuussa 2026.")).toBeNull()
    expect(parseFinnishStartDate("Urakan on määrä valmistua kesäkuussa 2027.")).toBeNull()
  })

  it("ei lue kaavan tai suunnittelun aloitusta", () => {
    expect(parseFinnishStartDate("Kaavoitus alkoi tammikuussa 2024.")).toBeNull()
    expect(parseFinnishStartDate("Suunnittelu käynnistyi maaliskuussa 2025.")).toBeNull()
    expect(parseFinnishStartDate("YVA-menettely käynnistyi huhtikuussa 2023.")).toBeNull()
  })

  it("ei hyväksy pelkkää vuotta", () => {
    expect(parseFinnishStartDate("Rakentaminen alkoi 2019.")).toBeNull()
    expect(parseFinnishStartDate("Rakennus valmistui 1962, purkutyöt alkoivat 2019.")).toBeNull()
  })

  it("ei poimi seuraavan virkkeen päivää", () => {
    expect(
      parseFinnishStartDate("Rakentaminen alkaa aikanaan. Kohde valmistuu lokakuussa 2026.")
    ).toBeNull()
  })
})

describe("vuodeton kuukausi ennen osumaa (D-324)", () => {
  it("ottaa aloituskuukauden, ei valmistumiskuukautta", () => {
    expect(
      parseFinnishStartDate("Rakennustyöt alkavat huhtikuussa ja valmista on arviolta lokakuussa 2026.")
        ?.paiva
    ).toBe("2026-04-01")
  })

  it("ottaa kuukausivälin alun", () => {
    expect(parseFinnishStartDate("Rakentaminen alkaa elo–syyskuussa 2026.")?.paiva).toBe("2026-08-01")
  })
})

describe("julkaisuleima ei ole aloituspäivä (D-324)", () => {
  it("ei lue uutissivun päivämääräleimaa aloitukseksi", () => {
    expect(parseFinnishStartDate("Myllypellon koulun rakentaminen alkaa Uutiset 5.2.2026")).toBeNull()
    expect(parseFinnishStartDate("Rakennustyöt alkavat Julkaistu 12.3.2026")).toBeNull()
  })

  it("lukee silti oikean tarkan päivän", () => {
    expect(parseFinnishStartDate("Rakentaminen alkoi Akaan Toijalassa 11.2.2025")?.paiva).toBe("2025-02-11")
  })
})
