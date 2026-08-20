import { describe, it, expect } from "vitest"
import { findProjectMatchDetailed, titleCoverage } from "./projectMatcher"

const BLANK = {
  city: null,
  region: null,
  location: null,
  permitNumber: null,
  propertyId: null,
  developer: null,
  buildingType: null,
  estimatedCompletion: null,
  description: null,
}

const project = (id: string, name: string, extra: Record<string, any> = {}) => ({
  id,
  name,
  city: null,
  region: null,
  location: null,
  phase: "Suunnittelussa",
  status: "active",
  completed_at: null,
  developer: null,
  property_type: null,
  estimated_completion: null,
  additional_info: null,
  metadata: null,
  ...extra,
})

describe("findProjectMatchDetailed — sijainnin tarkkuus", () => {
  /*
   * Käsin täydennetty oikea tieto ei saa huonontaa tulosta. Kun osoitteeksi
   * merkitään pelkkä kunnan nimi, se ei ole todiste samasta kohteesta -
   * muuten kaksi saman kaupungin eri hanketta yhdistyisivät.
   */
  it("ei yhdistä eri hankkeita pelkän kaupunginnimen perusteella", () => {
    const projects = [
      project("a", "Kaksi asuinkerrostaloa Pukimon kortteliin Kouvolassa", {
        city: "Kouvola",
        region: "Kymenlaakso",
        location: "Kouvola",
      }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      region: "Kymenlaakso",
      location: "Kouvola",
    } as any)

    expect(match?.reasons ?? []).not.toContain("same_location")
    expect(match?.confidence ?? 0).toBeLessThan(70)
  })

  /*
   * Käsin täydennetyn tiedon pitää auttaa: sama rakennuttaja samassa
   * kaupungissa nostaa hankkeen esiin mahdollisena duplikaattina, vaikka
   * uutisotsikko ei muistuta hankkeen nimeä.
   */
  it("tunnistaa mahdollisen duplikaatin rakennuttajasta ja kaupungista", () => {
    const projects = [
      project("a", "FIN04A Datakeskus", {
        city: "Kouvola",
        region: "Kymenlaakso",
        developer: "Atnorth",
      }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      region: "Kymenlaakso",
      developer: "AtNorth",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.reasons).toContain("same_developer")
    // Riittää mahdolliseksi duplikaatiksi (>= 40) muttei yhdistämiseen (>= 70)
    expect(match!.confidence).toBeGreaterThanOrEqual(40)
    expect(match!.confidence).toBeLessThan(70)
  })

  it("ei nosta pelkän rakennuttajan perusteella eri kaupungissa", () => {
    const projects = [
      project("a", "Aivan muu hanke", { city: "Oulu", developer: "Atnorth" }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Bravida nappasi 200 miljoonan datakeskusurakan",
      city: "Kouvola",
      developer: "AtNorth",
    } as any)

    expect(match).toBeNull()
  })

  it("yhdistää edelleen kun osoite on katutarkkuudella sama", () => {
    const projects = [
      project("a", "Kohde A", { city: "Kouvola", location: "Kauppakatu 12, Kouvola" }),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Kohde B",
      city: "Kouvola",
      location: "Kauppakatu 12, Kouvola",
    } as any)

    expect(match?.reasons).toContain("same_location")
  })
})

describe("findProjectMatchDetailed — erottuva otsikko", () => {
  /*
   * Kandidaatilla on usein vain otsikko (yritysten lehdistötiedotteet).
   * Ennen tätä sääntöä exact_title antoi 55 pistettä eikä kynnys 70 ylittynyt
   * koskaan pelkällä nimellä, joten jo tunnetusta hankkeesta kertova uutisi
   * päätyi uutena ehdokkaana jonoon.
   */
  it("täsmää pelkällä pitkällä identtisellä otsikolla", () => {
    const projects = [project("a", "FINNOONNIITYN LINJA-AUTOVARIKKO")]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "FINNOONNIITYN LINJA-AUTOVARIKKO",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.confidence).toBeGreaterThanOrEqual(70)
    expect(match?.reasons).toContain("exact_distinctive_title")
  })

  it("ei täsmää lyhyellä otsikolla ilman muuta todistetta", () => {
    const projects = [project("a", "Mastojen rakentaminen")]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Mastojen rakentaminen",
    } as any)

    // Osuma löytyy mutta jää kynnyksen alle, joten tuonti ei yhdistä niitä.
    expect(match?.confidence).toBeLessThan(70)
    expect(match?.reasons).toContain("exact_title")
  })

  /*
   * Aineistossa on eri hankkeita samalla nimellä. Silloin otsikko ei kerro
   * kummasta on kyse, ja umpimähkäinen päivitys olisi pahempi kuin ehdokkaan
   * jättäminen ihmisen arvioitavaksi.
   */
  it("ei täsmää kun sama otsikko on usealla hankkeella", () => {
    const projects = [
      project("a", "Rakentamista valmisteleva puiden kaato tontilta"),
      project("b", "Rakentamista valmisteleva puiden kaato tontilta"),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Rakentamista valmisteleva puiden kaato tontilta",
    } as any)

    expect(match).toBeNull()
  })

  it("täsmää monitulkintaisesta nimestä huolimatta kun on muutakin todistetta", () => {
    const projects = [
      project("a", "Rakentamista valmisteleva puiden kaato tontilta", {
        city: "Espoo",
      }),
      project("b", "Rakentamista valmisteleva puiden kaato tontilta"),
    ]

    const match = findProjectMatchDetailed(projects as any, {
      ...BLANK,
      name: "Rakentamista valmisteleva puiden kaato tontilta",
      city: "Espoo",
    } as any)

    expect(match?.project.id).toBe("a")
    expect(match?.reasons).toContain("same_city")
  })
})

describe("different_name_subjects", () => {
  /*
   * Mitattu tapaus: "Tikan päiväkodin purku-urakka" ja "Tikkakosken
   * päiväkodin purku-urakka" saivat varmuuden 100 ja yhdistyivät, vaikka
   * ovat eri päiväkoti (JyväskyläDno-2025-1438 ja -1439). Yhteinen osa
   * ("päiväkodin purku-urakka") on geneerinen ja hukuttaa erottavan sanan.
   *
   * Koko hankejoukossa vastaavia oli 194 paria 267:stä jotka ylittivät
   * yhdistämiskynnyksen.
   */
  it("painaa eri kohteen kynnyksen alle", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Tikan päiväkodin purku-urakka", { city: "Jyväskylä" })],
      { ...BLANK, name: "Tikkakosken päiväkodin purku-urakka", city: "Jyväskylä" }
    )
    expect(match?.reasons).toContain("different_name_subjects")
    expect(match!.confidence).toBeLessThan(70)
  })

  /*
   * RAJOITTAVA, EI ESTÄVÄ: pari jää ihmisen katsottavaksi eikä katoa.
   * Sama periaate kuin numeroerossa.
   */
  it("jättää parin ehdotukseksi eikä pudota nollaan", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Tikan päiväkodin purku-urakka", { city: "Jyväskylä" })],
      { ...BLANK, name: "Tikkakosken päiväkodin purku-urakka", city: "Jyväskylä" }
    )
    expect(match!.confidence).toBeGreaterThan(0)
  })

  /*
   * Yksipuolinen lisäys on tarkennus, ei ero - sama hanke eri
   * päätösvaiheessa. Ilman tätä ehtoa jokainen "…, urakoitsijan valinta"
   * -otsikko olisi irronnut omaksi hankkeekseen.
   */
  it("ei laukea kun vain toisessa on ylimääräistä", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Nekalan koulun sisäilmakorjaus", { city: "Tampere" })],
      { ...BLANK, name: "Nekalan koulun sisäilmakorjaus, urakoitsijan valinta", city: "Tampere" }
    )
    expect(match?.reasons ?? []).not.toContain("different_name_subjects")
  })

  /*
   * Suomen taivutus ei saa laukaista sääntöä: "purkaminen" ja "purkamisen"
   * ovat sama sana eri sijassa.
   */
  it("ei laukea taivutusmuodosta", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Rakennuksen purkaminen Pesulatiellä", { city: "Jyväskylä" })],
      { ...BLANK, name: "Rakennusten purkamisen urakka Pesulatiellä", city: "Jyväskylä" }
    )
    expect(match?.reasons ?? []).not.toContain("different_name_subjects")
  })

  /*
   * LYHYT EROTTAVA SANA ON SILTI EROTTAVA. Nimivertailun tokenisointi
   * pudottaa alle neljan merkin sanat kohinana, mutta asunto-osakeyhtioiden
   * nimet ovat usein lyhyita. Mitattu: "Asunto Oy Helsingin Pyy" ja
   * "... Evia" saivat varmuuden 75, koska "Pyy" katosi eika erottavia
   * sanoja jaanyt molemmille puolille.
   */
  it("laukeaa myos lyhyesta erottavasta sanasta", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Asunto Oy Helsingin Pyy", { city: "Helsinki" })],
      { ...BLANK, name: "Asunto Oy Helsingin Evia", city: "Helsinki" }
    )
    expect(match?.reasons).toContain("different_name_subjects")
    expect(match!.confidence).toBeLessThan(70)
  })

  /*
   * Yhtiomuoto ja "Asunto" ovat jokaisessa taloyhtion nimessa, joten ne
   * eivat saa olla erottavia sanoja.
   */
  it("ei pida yhtiomuotoa erottavana sanana", () => {
    const match = findProjectMatchDetailed(
      [project("1", "Asunto Oy Helsingin Pyy", { city: "Helsinki" })],
      { ...BLANK, name: "Asunto Oyj Helsingin Pyy", city: "Helsinki" }
    )
    expect(match?.reasons ?? []).not.toContain("different_name_subjects")
  })

  /*
   * Tunniste voittaa: lupanumero on suora todiste samasta kohteesta, eikä
   * nimien sanaero kumoa sitä.
   */
  it("ei laukea kun lupanumero on sama", () => {
    const match = findProjectMatchDetailed(
      [
        project("1", "Tikan päiväkodin purku-urakka", {
          city: "Jyväskylä",
          metadata: { permit_number: "10219" },
        }),
      ],
      {
        ...BLANK,
        name: "Tikkakosken päiväkodin purku-urakka",
        city: "Jyväskylä",
        permitNumber: "10219",
      }
    )
    expect(match?.reasons ?? []).not.toContain("different_name_subjects")
    expect(match!.confidence).toBeGreaterThanOrEqual(70)
  })
})

describe("titleCoverage", () => {
  /*
   * Ehdotuslistan apufunktio, EI osa calculateMatchia. Kuntien
   * päätösotsikot ovat lomaketäytettä, jossa lyhyempi otsikko hukkuu
   * Jaccardissa — kattavuus lyhyempää vasten näkee sen.
   */
  it("nostaa lyhyen otsikon esiin pitkästä lomakeotsikosta", () => {
    const r = titleCoverage(
      "Herttoniemen kirkon purku-urakka",
      "Purkamislupahakemus, Herttoniemen kirkon purkaminen, Herttoniemi, Länsi-Herttoniemi, 091-043-0102-0005, Hiihtomäentie 23, Helsingin seurakuntayhtymä, Hiihtomäentie 23"
    )
    expect(r.sharedWords).toEqual(["herttoniemen", "kirkon"])
    expect(r.coverage).toBeCloseTo(2 / 3, 2)
  })

  /*
   * Kuntanimi ei ole todiste: ehdotukset haetaan jo valmiiksi samasta
   * kaupungista. Mitattu ilman tätä rajausta: kolme uutta ehdotusta,
   * kaikki vääriä ja kaikki pelkän kuntanimen varassa.
   */
  it("ei laske kuntanimeä yhteiseksi sanaksi", () => {
    const r = titleCoverage(
      "Lahden sote-keskuksen korjaus, Lahti",
      "Kokonaispurku-urakka, Lahden Nastolan kohteet"
    )
    expect(r.sharedWords).toEqual([])
    expect(r.coverage).toBe(0)
  })

  it("ei laske genetiivimuotoista kuntanimeä", () => {
    const r = titleCoverage(
      "Maanteiden parantaminen, Muurame",
      "Vt 9 Korpilahti-Keljonkangas (Jyväskylä ja Muurame)"
    )
    expect(r.sharedWords).not.toContain("muurame")
  })

  /*
   * Kaksi eri taloyhtiötä samassa korttelissa jakaa vain yhden sanan.
   * Ehdotus vaatii kaksi, joten tämä ei nouse listalle.
   */
  it("antaa vain yhden yhteisen sanan eri taloyhtiöille", () => {
    const r = titleCoverage("Asunto Oy Kuusiluodonrannan Runo", "Kuusiluodonrannan Saaga")
    expect(r.sharedWords).toEqual(["kuusiluodonrannan"])
  })

  it("kestää tyhjän otsikon", () => {
    expect(titleCoverage(null, "Jotain")).toEqual({ coverage: 0, sharedWords: [] })
    expect(titleCoverage("Jotain", "")).toEqual({ coverage: 0, sharedWords: [] })
  })
})
