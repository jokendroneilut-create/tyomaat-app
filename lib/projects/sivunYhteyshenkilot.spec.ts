import * as cheerio from "cheerio"
import { describe, expect, it } from "vitest"

import { sahkopostiVastaaNimea, sivunYhteyshenkilot } from "./sivunYhteyshenkilot"

/* Rakenteet tiedotesivuilta (D-200); nimet ja osoitteet keksittyjä. */
describe("sivunYhteyshenkilot", () => {
  it("ei liimaa vierekkäisiä elementtejä yhdeksi nimeksi", () => {
    const $ = cheerio.load(
      `<div><span>Meikäläinen</span><span>Toimitusjohtaja</span><span>Matti Meikäläinen</span><span>040 123 4567</span><span>matti.meikalainen@esimerkki.fi</span></div>`
    )
    const [c] = sivunYhteyshenkilot($)
    expect(c.name).toBe("Matti Meikäläinen")
    expect(c.email).toBe("matti.meikalainen@esimerkki.fi")
  })

  it("hylkää nimen muotoisen tekstin jonka osoite ei vastaa nimeä", () => {
    const $ = cheerio.load(`<p>Perustiedot Helsingin</p><p>puh. 040 123 4567</p><p>myynti@esimerkki.fi</p>`)
    expect(sivunYhteyshenkilot($)).toEqual([])
  })

  it("sama osoite vain kerran", () => {
    const $ = cheerio.load(
      `<p>Lisätietoja: Maija Meikäläinen, puh. 040 123 4567, maija.meikalainen@esimerkki.fi</p><p>Maija Meikäläinen maija.meikalainen@esimerkki.fi</p>`
    )
    expect(sivunYhteyshenkilot($)).toHaveLength(1)
  })
})

describe("sahkopostiVastaaNimea", () => {
  it("vertaa ilman ääkkösiä", () => {
    expect(sahkopostiVastaaNimea("Keijo Mäkäräinen", "keijo.makarainen@esimerkki.fi")).toBe(true)
    expect(sahkopostiVastaaNimea("Taaleri Kiinteistöjen", "info@esimerkki.fi")).toBe(false)
  })
})

describe("sivunYhteyshenkilot - organisaation laatikot ja rikkinäiset osoitteet", () => {
  it("hylkää asuntomyynnin laatikon ja liimautuneen osoitteen", () => {
    const $ = cheerio.load(
      `<p>Asuntomyynti Tampere, puh. 040 123 4567, asuntomyynti.tampere@esimerkki.fi</p><p>Matti Meikäläinen, 040 765 4321, matti.meikalainen@esimerkki.fi.Tervetuloa</p>`
    )
    expect(sivunYhteyshenkilot($)).toEqual([])
  })
})

describe("sivunYhteyshenkilot - verkkotunnus", () => {
  it("hylkää pisteellä alkavan verkkotunnuksen", () => {
    const $ = cheerio.load(`<p>Matti Meikäläinen, 040 765 4321, matti.meikalainen@.esimerkki.fi</p>`)
    expect(sivunYhteyshenkilot($)).toEqual([])
  })
})
