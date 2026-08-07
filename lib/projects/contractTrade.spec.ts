import { describe, it, expect } from "vitest"
import { detectTrades, haveDifferentTrades } from "./contractTrade"

describe("detectTrades", () => {
  it("tunnistaa urakkalajin yhdyssanasta", () => {
    expect([...detectTrades("Rakennusurakka Kuhmon terveysaseman uudisrakennus")]).toEqual(["rakennus"])
    expect([...detectTrades("Sähköurakka Kuhmon terveysaseman uudisrakennus")]).toEqual(["sahko"])
    expect([...detectTrades("Ilmanvaihtourakka Kuhmon terveysaseman uudisrakennus")]).toEqual(["lvi"])
  })

  it("sietää yhdysmerkit", () => {
    expect([...detectTrades("Kesälahden vanhan koulun purku-urakka")]).toEqual(["purku"])
    expect([...detectTrades("Puitejärjestely, IV-työt vuosisopimusperiaatteella")]).toEqual(["lvi"])
    expect([...detectTrades("Kesälahden koulun ja päiväkodin KVR-urakka")]).toEqual(["rakennus"])
  })

  /*
   * Kohteen nimi ei ole urakkalaji. Ilman urakka/työ-päätteen vaatimusta
   * "Sähköasema Vantaalle" olisi mennyt sähköurakaksi ja estänyt osumia
   * väärin perustein.
   */
  it("ei tulkitse kohteen nimeä urakkalajiksi", () => {
    expect(detectTrades("Sähköasema Vantaalle").size).toBe(0)
    expect(detectTrades("Uimahalli Lappeenrantaan").size).toBe(0)
    expect(detectTrades("Kerrostalo Nihtiin As Oy Saarenhelmi").size).toBe(0)
  })

  /*
   * Rinnastettu yhdyssana: "LVI-" jää ilman urakkapäätettä, mutta tarkoittaa
   * LVI-urakkaa. Ilman tätä sääntö näkisi vain sähköurakan ja estäisi osuman
   * aitoon LVI-urakkaan väärin perustein.
   */
  it("tunnistaa rinnastetun yhdyssanan molemmat lajit", () => {
    const trades = detectTrades("LVI- ja sähköurakka, Kuhmo")
    expect(trades.has("lvi")).toBe(true)
    expect(trades.has("sahko")).toBe(true)
  })

  it("tunnistaa useamman roikkuvan alun", () => {
    const trades = detectTrades("Lämpö-, Vesi- ja Automaatiourakka Kuhmon terveysasema")
    expect(trades.has("lvi")).toBe(true)
    expect(trades.has("sahko")).toBe(true)
  })

  it("ei kanna roikkuvaa alkua yli muun sanan", () => {
    // "Purku-" ei liity "sähköurakkaan" koska välissä on muu sana.
    const trades = detectTrades("Purku- ja muut työt, myöhemmin sähköurakka")
    expect(trades.has("purku")).toBe(false)
  })
})

describe("haveDifferentTrades", () => {
  /*
   * Mitattu tapaus: Kuhmon terveysaseman uudisrakennus kilpailutettiin
   * neljänä erillisenä urakkana. Sama kohde, eri urakoitsija, eri
   * kohdeyleisö - ne eivät saa yhdistyä.
   */
  it("estää saman kohteen eri urakat", () => {
    expect(
      haveDifferentTrades(
        "Rakennusurakka Kuhmon terveysaseman uudisrakennus",
        "Sähköurakka Kuhmon terveysaseman uudisrakennus"
      )
    ).toBe(true)

    expect(
      haveDifferentTrades(
        "Kesälahden koulun ja päiväkodin KVR-urakka, Kiteen kaupunki",
        "Kesälahden vanhan koulun purku-urakka, Kiteen kaupunki"
      )
    ).toBe(true)
  })

  it("ei estä kun laji puuttuu toiselta", () => {
    expect(
      haveDifferentTrades("Sähköurakka Kuhmon terveysasema", "Kuhmon terveysasema")
    ).toBe(false)
  })

  it("ei estä kun lajit leikkaavat", () => {
    expect(
      haveDifferentTrades("LVI- ja sähköurakka, Kuhmo", "Sähköurakka, Kuhmo")
    ).toBe(false)
  })

  /*
   * Aidot duplikaatit eivät saa jäädä kiinni: kummallakaan ei ole
   * urakkalajia nimessä, joten sääntö ei koske niitä.
   */
  it("ei estä aitoja duplikaatteja", () => {
    expect(
      haveDifferentTrades("Hauspannan silta, Naantali", "Hauspannan silta, Naantali")
    ).toBe(false)
    expect(haveDifferentTrades("Gropintien rakentaminen", "Gropintien rakentaminen")).toBe(false)
  })

  /*
   * Vartalot ovat etuliitteitä, joten lyhyempi osuu pidemmän alkuun.
   * "vesikattourakka" alkaa vartalolla "vesi" (lvi) ja "vesikatto" (katto),
   * jolloin se luokittui molemmiksi - eivätkä lajijoukot enää olleet
   * erilliset, joten veto ei estänyt vesikatto- ja putkiurakan yhdistämistä.
   * Pisin vartalo voittaa.
   */
  it("ei sekoita vesikattourakkaa putkiurakkaan", () => {
    expect([...detectTrades("Vesikattourakka")]).toEqual(["katto"])
    expect(haveDifferentTrades("Vesikattourakka, Kuhmo", "Putkiurakka, Kuhmo")).toBe(
      true
    )
  })

  /*
   * Rakennusautomaatio kuuluu rakennusurakkaan, ei sähköurakkaan. Tämä on
   * alan käytäntö eikä seuraa vartaloista, joten se varmistetaan testillä.
   */
  it("pitää rakennusautomaatiourakan rakennusurakkana", () => {
    expect([...detectTrades("Rakennusautomaatiourakka")]).toEqual(["rakennus"])
  })

  /*
   * LV (lämpö-vesi) on vakiintunut lyhenne siinä missä LVI ja IV. Ilman omaa
   * vartaloaan se jäi tunnistamatta, jolloin veto ei lauennut lainkaan -
   * se vaatii lajin molemmilta puolilta.
   */
  it("tunnistaa LV-lyhenteen omana lajinaan", () => {
    expect([...detectTrades("LV-työt")]).toEqual(["lvi"])
    expect([...detectTrades("LV-urakka")]).toEqual(["lvi"])
    expect(
      haveDifferentTrades(
        "Puitejärjestely, LV-työt vuosisopimusperusteisesti",
        "Puitejärjestely, rakennusautomaatiotyöt"
      )
    ).toBe(true)
  })

  it("sietää tyhjät", () => {
    expect(haveDifferentTrades(null, "Sähköurakka")).toBe(false)
    expect(haveDifferentTrades("", "")).toBe(false)
  })
})
