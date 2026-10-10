import { describe, it, expect } from "vitest"
import { haveDifferentTrades } from "./contractTrade"

/*
 * Nama parit ovat tuotannon ehdokkaista 10.10.2026: saman rakennuksen
 * eri urakoita jotka olivat valuneet samaksi riviksi osoitteen
 * perusteella (D-264). Veton on estettava yhdistaminen.
 */
describe("haveDifferentTrades: saman kohteen eri urakat", () => {
  const parit: [string, string][] = [
    ["Kaislakatu 3 muutostöiden rakennusurakka, Joensuu", "Kaislakatu 3 muutostöiden LVI-urakka, Joensuu"],
    ["Imatran paloaseman rakennusurakka (pääurakka)", "Imatran paloaseman IV-urakka, sivu-urakka (IU)"],
    ["Kaukametsän kansalaisopiston korjaustyöt, LVI-urakka", "Kaukametsän kansalaisopiston korjaustyöt, sähköurakka"],
  ]
  for (const [a, b] of parit) {
    it(`eri urakka: ${a.slice(0, 38)}`, () => {
      expect(haveDifferentTrades(a, b)).toBe(true)
    })
  }

  /*
   * Keskeytysilmoitus ja alkuperainen ovat SAMA hankinta — naita ei saa
   * erottaa. Suurin osa 58:sta oli tata lajia.
   */
  it("keskeytysilmoitus ei ole eri urakka", () => {
    expect(haveDifferentTrades("Kirvesmiestyöt", "KESKEYTYSILMOITUS Kirvesmiestyöt")).toBe(false)
  })

  it("tunnistamaton laji ei estä yhdistämistä", () => {
    expect(haveDifferentTrades("Hoitajantie 3 hanke", "Toinen hanke")).toBe(false)
  })
})
