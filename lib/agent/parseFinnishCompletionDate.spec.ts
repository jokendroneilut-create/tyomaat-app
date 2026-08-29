import { describe, it, expect } from "vitest"
import { parseEstimatedCompletionDate, parseReleaseDate } from "./parseFinnishCompletionDate"

describe("parseEstimatedCompletionDate", () => {
  it("poimii kuukauden ja vuoden", () => {
    expect(
      parseEstimatedCompletionDate("Kohteen arvioidaan valmistuvan lokakuussa 2026.")
    ).toBe("2026-10-31")
  })

  /*
   * Vuodenaika arvioidaan kauden VIIMEISEKSI kuukaudeksi, koska arviota
   * käytetään automaattiseen valmistuneeksi siirtoon - liian aikainen arvio
   * piilottaisi käynnissä olevan hankkeen asiakkailta.
   */
  it("arvioi vuodenajan myöhäisimpään kuukauteen", () => {
    expect(parseEstimatedCompletionDate("Kohde valmistuu keväällä 2027.")).toBe(
      "2027-05-31"
    )
  })

  it("poimii pelkän vuoden", () => {
    expect(
      parseEstimatedCompletionDate("Hankkeen valmistuminen vuonna 2028.")
    ).toBe("2028-12-31")
  })

  /*
   * Menneen aikamuodon on jäätävä ulkopuolelle. Mitattuna 4412 hankkeen
   * kuvauksista menneen muodon osumista EI YKSIKÄÄN koskenut hanketta itseään:
   * ne kertoivat purettavasta vanhasta rakennuksesta, valmistuneesta
   * kaavaselvityksestä tai naapurirakennuksesta.
   */
  it("ei poimi mennyttä aikamuotoa", () => {
    expect(
      parseEstimatedCompletionDate(
        "Puretaan vuonna 1987 valmistunut päärakennus."
      )
    ).toBeNull()
    expect(
      parseEstimatedCompletionDate("Yleissuunnitelma valmistui vuonna 2019.")
    ).toBeNull()
  })

  /*
   * Päivämäärän on oltava valmistumissanan lähellä, jottei tekstin muualla
   * mainittu aloituspäivä poimiudu valmistumiseksi.
   */
  it("ei poimi kaukana olevaa päivämäärää", () => {
    expect(
      parseEstimatedCompletionDate(
        "Kohde valmistuu aikanaan. Rakennustyöt käynnistyivät tammikuussa 2025 " +
          "ja alueella on tehty valmistelevia töitä jo pitkään."
      )
    ).toBeNull()
  })

  it("sietää tyhjän", () => {
    expect(parseEstimatedCompletionDate("")).toBeNull()
  })
})

describe("kuukausi ilman vuotta", () => {
  /*
   * Laptin tiedotteen otsikko 20.8.2026. Poimija vaati vuosiluvun
   * kuukauden peraan, joten valmistumisaika jai kokonaan poimimatta.
   */
  it("paattelee vuoden julkaisupaivasta", () => {
    expect(
      parseEstimatedCompletionDate(
        "Hiukkavaaran uudet rivitalokodit valmistuvat marraskuussa",
        "2026-08-20"
      )
    ).toBe("2026-11-30")
  })

  /* Mennyt kuukausi tarkoittaa seuraavaa vuotta. */
  it("siirtaa seuraavaan vuoteen kun kuukausi on jo mennyt", () => {
    expect(
      parseEstimatedCompletionDate("Kohde valmistuu maaliskuussa", "2026-12-01")
    ).toBe("2027-03-31")
  })

  /* Ilman viitepaivaa vuotta ei arvata. */
  it("ei arvaa vuotta ilman julkaisupaivaa", () => {
    expect(parseEstimatedCompletionDate("Kohde valmistuu marraskuussa")).toBeNull()
  })

  /* Nimenomainen vuosi voittaa paattelyn. */
  it("kayttaa tekstissa mainittua vuotta", () => {
    expect(
      parseEstimatedCompletionDate("Kohde valmistuu marraskuussa 2028", "2026-08-20")
    ).toBe("2028-11-30")
  })
})

describe("parseReleaseDate", () => {
  it("lukee julkaisupaivan tekstista", () => {
    expect(parseReleaseDate("uutinen 20.8.2026 Asunto Oy Oulun Valoisa")).toBe("2026-08-20")
  })

  it("torjuu mahdottoman paivan", () => {
    expect(parseReleaseDate("31.2.2026")).toBeNull()
  })

  it("palauttaa nullin kun paivaa ei ole", () => {
    expect(parseReleaseDate("ei paivamaaraa")).toBeNull()
  })
})

describe("parseReleaseDate ilman valilyontia", () => {
  /* Laptin tiedotteessa lukee "uutinen20.8.2026" ilman valia. */
  it("lukee paivan kiinni edellisessa sanassa", () => {
    /* "2.9." ei ole taydellinen paivays, joten se ohitetaan. */
    expect(parseReleaseDate("esittelyasunto avautuu 2.9.uutinen20.8.2026 Asunto Oy")).toBe(
      "2026-08-20"
    )
  })
})
