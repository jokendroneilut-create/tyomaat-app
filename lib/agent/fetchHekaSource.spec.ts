import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  HEKA,
  HEKA_SIVU,
  hekaEhdokas,
  jasennaHekaSivu,
  osoiteAnkkuri,
  yksiPerOsoite,
} from "./fetchHekaSource"

/*
 * Nayte on Hekan oikea sivu 8.10.2026 (D-251), tallennettuna
 * lyhennettyna: `__fixtures__/heka/uudiskohteet.html`.
 */
const html = readFileSync(join(__dirname, "__fixtures__", "heka", "uudiskohteet.html"), "utf8")

describe("jasennaHekaSivu (oikea sivu 8.10.2026)", () => {
  const kohteet = jasennaHekaSivu(html)

  it("lukee kahdeksan kohdetta eika sivupalkin linkkeja", () => {
    expect(kohteet.map((k) => k.osoite)).toEqual([
      "Paletinkierto 7",
      "Maunulantie 20",
      "Tihtaalinkatu 4",
      "Koirasaarentie 24",
      "Koirasaarentie 10",
      "Paletinkierto 11",
      "Kiribatinkatu 1",
      "Vuosaarentie 3",
    ])
  })

  it("lukee kaupunginosan, asuntomaaran ja tarkan paivan", () => {
    const k = kohteet.find((x) => x.osoite === "Koirasaarentie 10")!
    expect(k.kaupunginosa).toBe("Laajasalo")
    expect(k.asuntoja).toBe(65)
    expect(k.valmistuu).toBe("2027-10-29")
    expect(k.osio).toBe("Vuonna 2027 valmistuvat uudiskohteet")
  })

  it("paivan nollatayte: 31.5.2027 -> 2027-05-31", () => {
    expect(kohteet[0].valmistuu).toBe("2027-05-31")
  })

  it("asuntoja yhteensa 676", () => {
    expect(kohteet.reduce((s, k) => s + (k.asuntoja ?? 0), 0)).toBe(676)
  })

  it("seniorikohde jaa lisatiedoksi eika kaupunginosaksi", () => {
    const k = kohteet.find((x) => x.osoite === "Maunulantie 20")!
    expect(k.kaupunginosa).toBe("Maunula")
    expect(k.lisatiedot).toEqual(["seniorikohde"])
    expect(k.asuntoja).toBe(55)
  })

  /* "Vuonna 2027 valmistuvat" ja "valmistumisaika" eivat ole valmistumista. */
  it("yksikaan ei ole valmistunut", () => {
    expect(kohteet.every((k) => !k.valmis)).toBe(true)
  })
})

describe("hekaEhdokas", () => {
  const ehdokkaat = jasennaHekaSivu(html).map(hekaEhdokas)
  const koira10 = ehdokkaat.find((e) => e.location === "Koirasaarentie 10")!

  it("nimeaa kuten kasin lisatty: Heka <kaupunginosa>, <osoite>", () => {
    expect(koira10.name).toBe("Heka Laajasalo, Koirasaarentie 10")
  })

  it("rakennuttaja, kaupunki, tyyppi, vaihe ja asunnot", () => {
    expect(koira10.developer).toBe(HEKA)
    expect(koira10.city).toBe("Helsinki")
    expect(koira10.region).toBe("Uusimaa")
    expect(koira10.property_type).toBe("Kerrostalo")
    expect(koira10.phase).toBe("Rakenteilla")
    expect(koira10.estimated_completion).toBe("2027-10-29")
    expect(koira10.metadata.apartments).toBe(65)
    expect("completed" in koira10).toBe(false)
  })

  it("source_url on sivu + osoitefragmentti, ja jokainen on eri", () => {
    expect(koira10.source_url).toBe(`${HEKA_SIVU}#koirasaarentie-10`)
    expect(new Set(ehdokkaat.map((e) => e.source_url)).size).toBe(8)
  })

  it("Jatkasaaren aakkoset fragmentissa ASCII:na", () => {
    expect(osoiteAnkkuri("Hämeentie 3 A")).toBe("hameentie-3-a")
    expect(osoiteAnkkuri("Kiribatinkatu 1")).toBe("kiribatinkatu-1")
  })

  it("kuvaus on sivun oma rivi", () => {
    expect(koira10.description).toContain(
      "Koirasaarentie 10, Laajasalo, 65 asuntoa, arvioitu valmistumisaika 29.10.2027"
    )
  })
})

describe("valmistuminen vaatii sivun oman sanan", () => {
  const sivu = (sisalto: string) =>
    `<main><div class="content__body">${sisalto}</div></main>`

  it("valiotsikko 'valmistuneet' merkitsee valmiiksi", () => {
    const [k] = jasennaHekaSivu(
      sivu(`<h2>Vuonna 2026 valmistuneet uudiskohteet</h2>
            <ul><li>Paletinkierto 7, Kuninkaantammi, 68 asuntoa, valmistui 31.5.2027</li></ul>`)
    )
    expect(k.valmis).toBe(true)
    const e = hekaEhdokas(k)
    expect(e.phase).toBe("Valmistunut")
    expect(e.completed).toBe(true)
  })

  it("rivin 'valmistui' merkitsee valmiiksi", () => {
    const [k] = jasennaHekaSivu(
      sivu(`<h2>Uudiskohteet</h2><ul><li>Kiribatinkatu 1, Jätkäsaari, 128 asuntoa, valmistui 31.10.2027</li></ul>`)
    )
    expect(k.valmis).toBe(true)
  })

  /* [[hiding-threshold]]: arvio voi venya. */
  it("mennyt arviopaiva ei yksin merkitse valmiiksi", () => {
    const [k] = jasennaHekaSivu(
      sivu(`<h2>Vuonna 2025 valmistuvat uudiskohteet</h2>
            <ul><li>Paletinkierto 7, Kuninkaantammi, 68 asuntoa, arvioitu valmistumisaika 31.5.2025</li></ul>`)
    )
    expect(k.valmis).toBe(false)
    expect(hekaEhdokas(k).phase).toBe("Rakenteilla")
  })

  it("sama osoite kahdesti: valmistunut voittaa", () => {
    const kohteet = jasennaHekaSivu(
      sivu(`<h2>Vuonna 2027 valmistuvat uudiskohteet</h2>
            <ul><li>Paletinkierto 7, Kuninkaantammi, 68 asuntoa, arvioitu valmistumisaika 31.5.2027</li></ul>
            <h2>Valmistuneet uudiskohteet</h2>
            <ul><li>Paletinkierto 7, Kuninkaantammi, 68 asuntoa</li></ul>`)
    )
    const yksi = yksiPerOsoite(kohteet)
    expect(yksi).toHaveLength(1)
    expect(yksi[0].valmis).toBe(true)
  })

  it("kuukauden tarkkuus kelpaa varalla", () => {
    const [k] = jasennaHekaSivu(
      sivu(`<ul><li>Paletinkierto 7, Kuninkaantammi, 68 asuntoa, arvioitu valmistuminen 12/2028</li></ul>`)
    )
    expect(k.valmistuu).toBe("2028-12-31")
  })

  it("rivi ilman osoitetta ei ole kohde", () => {
    expect(jasennaHekaSivu(sivu(`<ul><li>Hae asuntoa Helsingin kaupungilta</li></ul>`))).toEqual([])
  })
})
