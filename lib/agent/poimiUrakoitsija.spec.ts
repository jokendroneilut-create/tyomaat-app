import { describe, it, expect } from "vitest"
import { poimiUrakoitsijat } from "./poimiUrakoitsija"

/*
 * Jokainen otos on katkelma oikeasta Fingridin hankekuvauksesta, jotta
 * muotojen kirjo on tarkistettavissa jos sivut muuttuvat.
 */
describe("poimiUrakoitsijat", () => {
  it("poimii perusmuodon ja saa non-ASCII-paatteisen nimen kokonaan", () => {
    expect(
      poimiUrakoitsijat("Jylkkä-Kukonkylä Urakoitsijaksi on valittu Leonhard Weiss Oü. Valtioneuvosto on")
    ).toEqual(["Leonhard Weiss Oü"])
  })

  it("poimii sanan verbin edesta ja maaritteen verbin jalkeen", () => {
    expect(
      poimiUrakoitsijat("Pääurakoitsijana hankkeessa toimii italialainen Tecnolines Italia s.r.l. Jos teille")
    ).toEqual(["Tecnolines Italia s.r.l."])
  })

  it("poimii toimii-muodon", () => {
    expect(poimiUrakoitsijat("Urakoitsijana toimii Enersense PN Oy. Lisätietoja")).toEqual(["Enersense PN Oy"])
  })

  /* Otsikkomuoto esittelee urakoitsijan yhteyshenkilot, verbia ei ole. */
  it("poimii otsikkomuodon", () => {
    expect(poimiUrakoitsijat("Urakoitsija ENP Power Oy: Lauri Tolpanniemi Työmaapäällikkö")).toEqual([
      "ENP Power Oy",
    ])
  })

  it("poimii yhdyssanan sisalta", () => {
    expect(
      poimiUrakoitsijat("Länsisalmen sähköasemaurakoitsijaksi on valittu Hitachi Energy Finland Oy lokakuussa")
    ).toEqual(["Hitachi Energy Finland Oy"])
  })

  /*
   * ISO ALKUKIRJAIN TARKISTETAAN KOODISSA: i-lipun alla [A-Z] osuisi
   * myos pieniin, joten regex ei voi sita vaatia.
   */
  it("ei poimi yleisnimea pienella kirjaimella", () => {
    expect(poimiUrakoitsijat("otattehan yhteyttä ensisijaisesti urakoitsijan edustajiin")).toEqual([])
    expect(poimiUrakoitsijat("urakoitsijaksi on valittu jokin muu oy")).toEqual([])
  })

  it("ei poimi tilaajaa urakoitsijaksi", () => {
    expect(poimiUrakoitsijat("Urakoitsijana toimii Fingrid Oyj")).toEqual([])
  })

  /* Osuuskohtainen hanke: monta urakoitsijaa, sama yritys kahdesti. */
  it("poimii kaikki osuudet ja yhdistaa toiston", () => {
    const teksti =
      "Jylkkä-Kukonkylä Urakoitsijaksi on valittu Leonhard Weiss Oü. " +
      "Kukonkylä-Ullava Urakoitsijaksi on valittu Caverion Suomi Oy. " +
      "Ullava-Halsua Urakoitsijaksi on valittu Enersense PN Oy. " +
      "Ullava-Alajärvi Urakoitsijaksi on valittu Caverion Suomi Oy."
    expect(poimiUrakoitsijat(teksti)).toEqual([
      "Leonhard Weiss Oü",
      "Caverion Suomi Oy",
      "Enersense PN Oy",
    ])
  })

  it("palauttaa tyhjan kun tekstia ei ole", () => {
    expect(poimiUrakoitsijat(null)).toEqual([])
    expect(poimiUrakoitsijat("")).toEqual([])
    expect(poimiUrakoitsijat("Hankkeen tila: Rakentaminen")).toEqual([])
  })
})
