import { describe, expect, it } from "vitest"

import { parseVaylaInfoFields, vaylanKustannus, vaylanUrakoitsijat} from "./vaylaInfoFields"

/* Kirjalansalmen sivun lohko sellaisenaan, välilyönnit mukaan lukien. */
const LOHKO = `
<div class="project__info__additional">
 <div class="project__info__additional__item">
  <strong> Urakoitsija </strong>
  <br> Kreate Oy
 </div>
 <div class="project__info__additional__item">
  <strong> Kustannukset </strong>
  <br> 128 miljoonaa euroa
 </div>
 <div class="project__info__additional__item">
  <strong> Tilaaja </strong>
  <br>Väylävirasto
 </div>
</div>`

describe("parseVaylaInfoFields", () => {
  it("lukee urakoitsijan, kustannuksen ja tilaajan", () => {
    const k = parseVaylaInfoFields(LOHKO)
    expect(k.urakoitsija).toBe("Kreate Oy")
    expect(k.tilaaja).toBe("Väylävirasto")
    expect(k.kustannusteksti).toBe("128 miljoonaa euroa")
    expect(k.kustannusEur).toBe(128_000_000)
  })

  /* `.text()` ottaisi otsikon mukaan: "Urakoitsija Kreate Oy". */
  it("ei ota kentan otsikkoa arvoon", () => {
    expect(parseVaylaInfoFields(LOHKO).urakoitsija).not.toMatch(/Urakoitsija/i)
  })

  it("palauttaa tyhjat kun lohkoa ei ole", () => {
    const k = parseVaylaInfoFields("<html><body><p>Ei lohkoa</p></body></html>")
    expect(k).toEqual({
      urakoitsija: null,
      tilaaja: null,
      kustannusteksti: null,
      kustannusEur: null,
      aikataulu: null,
    })
  })

  it("kestaa tyhjan", () => {
    expect(parseVaylaInfoFields(null).urakoitsija).toBeNull()
    expect(parseVaylaInfoFields("").kustannusEur).toBeNull()
  })

  /* Tuntematon avain ei saa paatya mihinkaan kenttaan. */
  it("ohittaa tuntemattoman kentan", () => {
    const html = `<div class="project__info__additional__item">
      <strong>Hankkeen tila</strong><br>Rakentaminen</div>`
    expect(parseVaylaInfoFields(html)).toEqual({
      urakoitsija: null,
      tilaaja: null,
      kustannusteksti: null,
      kustannusEur: null,
      aikataulu: null,
    })
  })
})

describe("vaylanKustannus", () => {
  it("lukee miljoonat, myos desimaalipilkulla", () => {
    expect(vaylanKustannus("128 miljoonaa euroa")).toBe(128_000_000)
    expect(vaylanKustannus("noin 3,8 miljoonaa euroa")).toBe(3_800_000)
    expect(vaylanKustannus("1,5 milj. €")).toBe(1_500_000)
  })

  it("lukee tavallisen euromaaran", () => {
    expect(vaylanKustannus("450 000 euroa")).toBe(450_000)
  })

  /*
   * Pieni luku ei ole hankkeen kustannus vaan jokin muu ("4 euroa/m2").
   * Kentta on harvinainen, joten arvailuun ei ole syyta.
   */
  it("hylkaa liian pienen luvun", () => {
    expect(vaylanKustannus("4 euroa")).toBeNull()
    expect(vaylanKustannus("9 999 euroa")).toBeNull()
  })

  it("palauttaa nullin kun lukua ei ole", () => {
    expect(vaylanKustannus("ei tiedossa")).toBeNull()
    expect(vaylanKustannus(null)).toBeNull()
  })
})

describe("vaylanUrakoitsijat", () => {
  it("hyvaksyy yhtiomuotoisen nimen", () => {
    expect(vaylanUrakoitsijat("Kreate Oy")).toEqual(["Kreate Oy"])
    expect(vaylanUrakoitsijat("GRK Suomi Oy")).toEqual(["GRK Suomi Oy"])
  })

  it("erottaa kaksi urakoitsijaa", () => {
    expect(vaylanUrakoitsijat("MP Infra Oy ja Arkos Oy")).toEqual(["MP Infra Oy", "Arkos Oy"])
  })

  /*
   * Nama neljaa esiintyi oikeassa aineistossa "Urakoitsija"-kentassa.
   * Kunta voi olla tilaaja muttei taman kentan perusteella.
   */
  it("hylkaa kuntalistan ja tilakuvauksen", () => {
    expect(vaylanUrakoitsijat("Naantalin kaupunki, Raision kaupunki")).toEqual([])
    expect(vaylanUrakoitsijat("Salon, Paimion ja Kaarinan kaupungit")).toEqual([])
    expect(vaylanUrakoitsijat("Useita urakoitsijoita")).toEqual([])
    expect(vaylanUrakoitsijat("Kilpailutetaan loppuvuonna")).toEqual([])
  })

  it("kestaa tyhjan", () => {
    expect(vaylanUrakoitsijat(null)).toEqual([])
    expect(vaylanUrakoitsijat("")).toEqual([])
  })
})

describe("vaylanUrakoitsijat: suunnittelija ja osapuolilista", () => {
  /* Hajala-Nunnan kentta sellaisenaan: tilaajakunnat ja konsultit samassa. */
  it("hylkaa arvon jossa on kuntia", () => {
    expect(
      vaylanUrakoitsijat("Salon, Paimion ja Kaarinan kaupungit, Sitowise Oy, Ramboll Oy")
    ).toEqual([])
  })

  /* Suunnitteluvaiheessa kentassa on konsultti, vaikka otsikko sanoo urakoitsija. */
  it("hylkaa tunnetun suunnittelijan", () => {
    expect(vaylanUrakoitsijat("Afry Finland Oy")).toEqual([])
    expect(vaylanUrakoitsijat("Sitowise Oy")).toEqual([])
  })

  it("ei hylkaa urakoitsijaa", () => {
    expect(vaylanUrakoitsijat("Destia Oy")).toEqual(["Destia Oy"])
    expect(vaylanUrakoitsijat("GRK Suomi Oy")).toEqual(["GRK Suomi Oy"])
  })
})

describe("vaylanKustannus: selvityksen hinta", () => {
  /* Merenkurkun sivulta sellaisenaan: 200 000 € on selvitys, ei yhteys. */
  it("hylkaa esiselvityksen hinnan", () => {
    expect(vaylanKustannus("Noin 200 000 euroa (esiselvitys)")).toBeNull()
    expect(vaylanKustannus("Selvityksen kustannus 150 000 euroa")).toBeNull()
  })

  /* "Budjetti X, toteuma Y" -> budjetti on kustannusarvio. */
  it("ottaa budjetin kun kentassa on myos toteuma", () => {
    expect(
      vaylanKustannus("Budjetti 18,3 miljoonaa euroa, toteuma 13,2 miljoonaa euroa*")
    ).toBe(18_300_000)
  })

  it("ei hylkaa tavallista kustannusta", () => {
    expect(vaylanKustannus("Kustannusarvio 16 miljoonaa euroa")).toBe(16_000_000)
  })
})
