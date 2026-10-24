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

/*
 * NYT ANNETAAN AINA EKSPLISIITTISESTI näissä testeissä: ikäraja on
 * suhteessa nykyhetkeen, ja ilman kiinnitettyä hetkeä testi menisi
 * rikki itsestään vuoden kuluttua (sama opetus kuin D-323).
 */
const NYT = new Date("2026-10-22T00:00:00Z")

describe("saneeraus ei aina ole rakennuksen saneeraus (D-326)", () => {
  it("ei lue yrityssaneerauksen aloitusta hankkeen aloitukseksi", () => {
    const teksti =
      "Tärkeät Tekijät Oy hakeutui yrityssaneerausmenettelyyn ja se aloitettiin 10.10.2022 " +
      "Helsingin käräjäoikeuden päätöksellä."
    expect(parseFinnishStartDate(teksti, new Date("2022-12-01T00:00:00Z"))).toBeNull()
  })

  it("lukee silti aidot saneerausyhdyssanat", () => {
    expect(
      parseFinnishStartDate("Linjasaneeraus alkaa toukokuussa 2026.", NYT)?.paiva
    ).toBe("2026-05-01")
    expect(
      parseFinnishStartDate("Putkisaneeraus käynnistyi elokuussa 2026.", NYT)?.paiva
    ).toBe("2026-08-01")
  })
})

describe("yli viisi vuotta vanha aloitus kertoo historiasta (D-326)", () => {
  /*
   * "Alakylän ohituskaistojen rakentaminen alkoi maaliskuussa 2014" --
   * kohde on hankkeen jo valmistunut aiempi osuus.
   */
  it("hylkää yli viisi vuotta vanhan aloituksen", () => {
    expect(
      parseFinnishStartDate("Alakylän ohituskaistojen rakentaminen alkoi maaliskuussa 2014.", NYT)
    ).toBeNull()
  })

  it("hyväksyy neljä vuotta vanhan aloituksen", () => {
    expect(
      parseFinnishStartDate("Rakennustyöt alkoivat purku-urakan osalta tammikuussa 2023.", NYT)?.paiva
    ).toBe("2023-01-01")
  })

  it("ikäraja on suhteessa annettuun hetkeen, ei kiinteään vuoteen", () => {
    const teksti = "Rakentaminen alkoi maaliskuussa 2014."
    expect(parseFinnishStartDate(teksti, new Date("2016-01-01T00:00:00Z"))?.paiva).toBe("2014-03-01")
    expect(parseFinnishStartDate(teksti, new Date("2026-01-01T00:00:00Z"))).toBeNull()
  })

  it("hylkää myos tarkan päivän jos se on liian vanha", () => {
    expect(
      parseFinnishStartDate("Rakentaminen alkoi Akaan Toijalassa 11.2.2015.", NYT)
    ).toBeNull()
  })
})

describe("valmistumissana valissa (D-326)", () => {
  /*
   * "rakentaminen on aloitettu, ja se valmistuu tammikuun 2026":
   * aloitus on tapahtunut mutta ei tiedeta milloin.
   */
  it("ei lue valmistumiskuukautta aloitukseksi", () => {
    expect(
      parseFinnishStartDate("Tekovan urakassa rakentaminen on aloitettu, ja se valmistuu tammikuun 2026.", NYT)
    ).toBeNull()
    expect(
      parseFinnishStartDate("Rakennustyot on aloitettu ja kohde otetaan kayttoon syyskuussa 2026.", NYT)
    ).toBeNull()
  })

  /* Aiempi vuodeton kuukausi voittaa edelleen. */
  it("lukee aloituskuukauden kun se on ennen valmistumissanaa", () => {
    expect(
      parseFinnishStartDate(
        "Rakennustyot alkavat huhtikuussa ja valmista on arviolta lokakuussa 2026.",
        NYT
      )?.paiva
    ).toBe("2026-04-01")
  })
})

describe("valmistumissana myos tarkan paivan haarassa (D-326)", () => {
  it("ei lue tarkkaa valmistumispaivaa aloitukseksi", () => {
    expect(
      parseFinnishStartDate(
        "Vartiokylan koulu-paivakoti: rakentaminen on aloitettu ja se valmistuu aikataulun mukaan 30.11.2027.",
        NYT
      )
    ).toBeNull()
  })

  it("lukee silti tarkan aloituspaivan", () => {
    expect(
      parseFinnishStartDate("Rakentaminen on kaynnistynyt 2.2.2026 HUSin Peijaksessa.", NYT)?.paiva
    ).toBe("2026-02-02")
  })
})

describe("vuodenaika aloituksena (D-347)", () => {
  it("lukee kauden ensimmaisen kuukauden", () => {
    expect(
      parseFinnishStartDate("Aurinkovoimalan rakentaminen alkaa keväällä 2027.")?.paiva
    ).toBe("2027-04-01")
    expect(parseFinnishStartDate("Rakennustyöt alkavat syksyllä 2027.")?.paiva).toBe("2027-09-01")
    expect(parseFinnishStartDate("Rakentaminen käynnistyy kesällä 2028.")?.paiva).toBe("2028-06-01")
    expect(parseFinnishStartDate("Purkutyöt alkavat talvella 2027.")?.paiva).toBe("2027-12-01")
  })

  it("merkitsee tarkkuudeksi kauden", () => {
    expect(
      parseFinnishStartDate("Rakentaminen alkaa keväällä 2027.")?.tarkkuus
    ).toBe("kausi")
  })

  it("kuukausi voittaa kauden kun molemmat mainitaan", () => {
    expect(
      parseFinnishStartDate("Rakentaminen alkaa toukokuussa 2027, eli keväällä 2027.")?.paiva
    ).toBe("2027-05-01")
  })

  it("ei lue kaavan eika suunnittelun aloitusta", () => {
    expect(parseFinnishStartDate("Kaavoitus alkaa keväällä 2027.")).toBeNull()
    expect(parseFinnishStartDate("Suunnittelu käynnistyy syksyllä 2027.")).toBeNull()
  })

  it("valmistumissana valissa estaa kauden", () => {
    expect(
      parseFinnishStartDate("Rakentaminen on aloitettu, ja se valmistuu keväällä 2027.")
    ).toBeNull()
  })
})
