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

/*
 * SELVITYS EI OLE HANKE (D-303).
 *
 * Johannes 18.10.2026 Harviala-Hangasmaen hankkeesta: "Arvioitu
 * valmistuminen 2024-12-31 mutta lahde sanoo vuoden 2030 aikana" --
 * ja tunnisti syyn itse: sivulla on kaksi valmistumismainintaa, ja
 * ensimmainen koskee ymparistoselvitysta.
 */
describe("parseEstimatedCompletionDate - selvitysvirke ohitetaan", () => {
  it("valitsee hankkeen eika selvityksen valmistumisen", () => {
    const teksti =
      "Voimajohtohankkeen vaikutuksista on käynnistynyt ympäristöselvitys, " +
      "joka valmistuu vuoden 2024 aikana. Alustavan aikataulun mukaan " +
      "voimajohdon rakentamisen arvioidaan valmistuvan vuoden 2030 aikana."
    expect(parseEstimatedCompletionDate(teksti)).toBe("2030-12-31")
  })

  it("ohittaa suunnitelman valmistumisen", () => {
    const teksti =
      "Rakentamissuunnitelmat valmistuvat vuoden 2025 aikana. " +
      "Syvennetty meriväylä ja uusi laituri valmistuvat arviolta alkuvuonna 2028."
    /*
     * "alkuvuonna" ei ole kausisanastossa, joten tulos on vuoden
     * viimeinen paiva. Se on tarkoitus: liian myohainen arvio on
     * turvallisempi kuin liian aikainen, koska kentta syottaa
     * automaattista valmistumista.
     */
    expect(parseEstimatedCompletionDate(teksti)).toBe("2028-12-31")
  })

  /*
   * Yhdyssanassa selvitys on sanan lopussa, joten sanarajaa ei voi
   * vaatia: "ymparistoselvitys", "maaperaselvitys".
   */
  it("tunnistaa selvityksen yhdyssanassa", () => {
    const teksti =
      "Maaperäselvitys valmistuu keväällä 2026. Rakennus valmistuu vuonna 2029."
    expect(parseEstimatedCompletionDate(teksti)).toBe("2029-12-31")
  })

  /*
   * Jos VAIN selvitysvirke on olemassa, luetaan koko teksti kuten
   * ennen -- muuten muutos poistaisi paivia riveilta joilla on yksi
   * maininta. Kirjattu, jotta tama on tiedossa eika yllatys.
   */
  it("palaa koko tekstiin jos muuta ei ole", () => {
    expect(
      parseEstimatedCompletionDate("Ympäristöselvitys valmistuu vuoden 2024 aikana.")
    ).toBe("2024-12-31")
  })
})

describe("tuotannon kaynnistyminen on valmistuminen (D-347)", () => {
  it("lukee sahkontuotannon alun valmistumiseksi", () => {
    expect(
      parseEstimatedCompletionDate("Sähköntuotannon on tarkoitus käynnistyä syksyllä 2027.")
    ).toBe("2027-11-30")
    expect(parseEstimatedCompletionDate("Tuotanto käynnistyy syksyllä 2027.")).toBe("2027-11-30")
    expect(
      parseEstimatedCompletionDate("Laitoksen on määrä käynnistyä kesäkuussa 2028.")
    ).toBe("2028-06-30")
  })

  it("EI lue rakentamisen kaynnistymista valmistumiseksi", () => {
    expect(
      parseEstimatedCompletionDate("Voimalan rakentaminen käynnistyy keväällä 2027.")
    ).toBeNull()
    expect(
      parseEstimatedCompletionDate("Hankkeen rakennustyöt käynnistyvät toukokuussa 2027.")
    ).toBeNull()
    expect(
      parseEstimatedCompletionDate("Laitoksen purkutyöt käynnistyvät syksyllä 2027.")
    ).toBeNull()
  })

  it("lukee molemmat paivat samasta virkkeesta", () => {
    const teksti =
      "Aurinkovoimalan rakentaminen alkaa keväällä 2027, ja sähköntuotannon on tarkoitus käynnistyä syksyllä 2027."
    expect(parseEstimatedCompletionDate(teksti)).toBe("2027-11-30")
  })
})
