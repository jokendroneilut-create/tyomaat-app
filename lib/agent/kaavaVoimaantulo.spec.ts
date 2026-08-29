import { describe, expect, it } from "vitest"

import {
  parseKaavaPaatos,
  parseKaavaPaatosTekstista,
  parseKaavaPaiva,
} from "./kaavaVoimaantulo"

/* Seinäjoen Lakeuden Etappi -kaavan käsittelyvaiheet sivulla 29.8.2026. */
const ETAPPI = [
  "18.4.2018 Kaupunkiympäristölautakunta käynnisti asemakaavan laadinnan",
  "17.9.2019 Kaavaluonnos sekä osallistumis- ja arviointisuunnitelma nähtävillä",
  "7.10.2019 Kaupunginhallitus hyväksyi kaavaehdotuksen nähtäville",
  "16.12.2019 Kaupunginvaltuusto hyväksyi asemakaavan",
  "29.1.2020 Voimaantulopäivä",
]

describe("parseKaavaPaiva", () => {
  it("lukee suomalaisen paivamaaran", () => {
    expect(parseKaavaPaiva("29.1.2020 Voimaantulopäivä")).toBe("2020-01-29")
    expect(parseKaavaPaiva("7.10.2019 Kaupunginhallitus")).toBe("2019-10-07")
  })

  it("hylkaa mahdottoman paivan", () => {
    expect(parseKaavaPaiva("32.1.2020")).toBeNull()
    expect(parseKaavaPaiva("1.13.2020")).toBeNull()
  })

  /* Kaavatunnus 57001 tai 1.2.3 ei ole paivamaara. */
  it("ei lue tunnusta paivamaaraksi", () => {
    expect(parseKaavaPaiva("Rahkola, kortteli 1 (57001)")).toBeNull()
    expect(parseKaavaPaiva("voimaan 1.1.1899")).toBeNull()
  })

  it("palauttaa nullin kun paivaa ei ole", () => {
    expect(parseKaavaPaiva("Voimaantulopäivä")).toBeNull()
  })
})

describe("parseKaavaPaatos", () => {
  /* Tama oli vika: paiva oli rivilla mutta se heitettiin pois. */
  it("poimii voimaantulopaivan viimeiselta paivatylta rivilta", () => {
    const tulos = parseKaavaPaatos(ETAPPI)
    expect(tulos.tila).toBe("voimassa")
    expect(tulos.paiva).toBe("2020-01-29")
    expect(tulos.rivi).toContain("Voimaantulopäivä")
  })

  /*
   * Kasittelyvaihelista sisaltaa tulevat vaiheet mallipohjana ilman
   * paivaa; vain paivatyt ovat tapahtuneita.
   */
  it("ohittaa paivattomat tulevat vaiheet", () => {
    const tulos = parseKaavaPaatos([...ETAPPI, "Voimaantulopäivä", "Lainvoimaisuuskuulutus"])
    expect(tulos.paiva).toBe("2020-01-29")
  })

  it("kertoo kesken olevasta kaavasta ettei se ole voimassa", () => {
    expect(parseKaavaPaatos(ETAPPI.slice(0, 3)).tila).toBe("kesken")
  })

  /*
   * Kumottu kaava ei toteudu. Se luettiin ennen samaksi kuin voimaantulo,
   * koska molemmat paattavat kaavoituksen: Seinajoen Roves ja Nurmon
   * kortteli 1004 nakyivat asiakkaalle aktiivisina 29.8.2026.
   */
  it("erottaa kumotun kaavan voimaan tulleesta", () => {
    const tulos = parseKaavaPaatos([
      "16.12.2019 Kaupunginvaltuusto hyväksyi asemakaavan",
      "3.5.2021 Vaasan hallinto-oikeus on kumonnut kaupunginvaltuuston päätöksen",
    ])
    expect(tulos.tila).toBe("kumottu")
    expect(tulos.paiva).toBe("2021-05-03")
  })

  it("erottaa lopetetun kaavan", () => {
    expect(
      parseKaavaPaatos(["12.3.2024 Kaava on lopetettu kaupunkiympäristölautakunnassa"]).tila
    ).toBe("kumottu")
  })

  /*
   * Kumoaminen voittaa vaikka voimaantulo olisi listassa myohemmin: juuri
   * se paatos kumottiin.
   */
  it("antaa kumoamisen voittaa voimaantulon", () => {
    expect(
      parseKaavaPaatos([
        "3.5.2021 Vaasan hallinto-oikeus on kumonnut päätöksen",
        "1.6.2021 Voimaantulopäivä",
      ]).tila
    ).toBe("kumottu")
  })

  it("kestaa tyhjan listan", () => {
    expect(parseKaavaPaatos([])).toEqual({ tila: "kesken", paiva: null, rivi: null })
  })

  /*
   * PORNAINEN: paiva on avainsanan JALKEEN. Jos paiva otetaan aina
   * avainsanaa edeltavasta kohdasta, kaava saa hyvaksymispaivan
   * voimaantulopaivakseen - kymmenen kuukautta vaarin. Tama osui
   * kuivaharjoituksessa ja loytyi vasta lahteesta tarkistamalla.
   */
  it("lukee paivan avainsanan jalkeen", () => {
    const tulos = parseKaavaPaatos([
      "Kunnanvaltuusto hyväksynyt 29.1.2007. Tullut voimaan: 26.11.2007",
    ])
    expect(tulos.tila).toBe("voimassa")
    expect(tulos.paiva).toBe("2007-11-26")
  })

  /* OULU kirjoittaa "Voimaantullut asemakaava". */
  it("tunnistaa voimaantullut-muodon", () => {
    const tulos = parseKaavaPaatos(["14.12.2022 Voimaantullut asemakaava pdf 720 KB"])
    expect(tulos.tila).toBe("voimassa")
    expect(tulos.paiva).toBe("2022-12-14")
  })

  /* Avainsanan lahin paiva on viimeinen sita ennen, ei ensimmainen. */
  it("ottaa lahimman paivan ennen avainsanaa", () => {
    const tulos = parseKaavaPaatos([
      "12.1.2020 Kaavaluonnos nähtävillä 3.3.2021 Kaupunginvaltuusto hyväksyi 4.4.2021 Voimaantulopäivä",
    ])
    expect(tulos.paiva).toBe("2021-04-04")
  })
})

describe("parseKaavaPaatosTekstista", () => {
  /* Sivun leipatekstissa vaiheet ovat yhtena jonona ilman rivinvaihtoja. */
  it("lukee vaiheet yhtenaisesta tekstista", () => {
    const teksti =
      "Käsittelyvaiheet 18.4.2018 Kaupunkiympäristölautakunta käynnisti asemakaavan " +
      "16.12.2019 Kaupunginvaltuusto hyväksyi asemakaavan 29.1.2020 Voimaantulopäivä"
    const tulos = parseKaavaPaatosTekstista(teksti)
    expect(tulos.tila).toBe("voimassa")
    expect(tulos.paiva).toBe("2020-01-29")
  })

  it("ei keksi paivaa tekstista jossa ei ole vaiheita", () => {
    expect(parseKaavaPaatosTekstista("Asemakaavan muutos koskee korttelia 47.").tila).toBe("kesken")
  })
})
