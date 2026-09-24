import { describe, expect, it } from "vitest"

import { passesDuplicateQualityBar } from "./qualityBar"

const pari = (confidence: number, reasons: string[]) =>
  ({ confidence, reasons } as any)

describe("passesDuplicateQualityBar", () => {
  it("hyvaksyy vahvan tunnisteen ilman muuta", () => {
    expect(passesDuplicateQualityBar(pari(70, ["same_permit_number"]))).toBe(true)
    expect(passesDuplicateQualityBar(pari(95, ["same_property_id"]))).toBe(true)
  })

  /*
   * Taloyhtio on rekisteroity nimi, ei kuvaileva otsikko: se kelpaa
   * vahvaksi tunnisteeksi katselmoitavassa listassa (D-171). Mitatut
   * parit jaivat 58-65 pisteeseen, joten ilman tata ne eivat loydy.
   */
  /*
   * Energiakohde on paikannimi joka yksiloi puiston kunnan sisalla
   * (D-213). YVA-hankkeen ja osayleiskaavan otsikot eivat muistuta
   * toisiaan, joten ilman tata pari ei loydy - mitattuna 32 paria.
   */
  it("hyvaksyy saman energiakohteen vahvana tunnisteena", () => {
    expect(passesDuplicateQualityBar(pari(65, ["same_energy_site", "same_city"]))).toBe(true)
    expect(
      passesDuplicateQualityBar(
        pari(73, ["same_city", "same_region", "same_building_type", "same_energy_site"])
      )
    ).toBe(true)
  })

  it("hyvaksyy saman taloyhtion vahvana tunnisteena", () => {
    expect(passesDuplicateQualityBar(pari(70, ["same_housing_company"]))).toBe(true)
    expect(
      passesDuplicateQualityBar(pari(70, ["same_housing_company", "name_in_description"]))
    ).toBe(true)
  })

  it("vaatii nimitodisteelta saman kaupungin", () => {
    expect(passesDuplicateQualityBar(pari(80, ["similar_title", "same_city"]))).toBe(true)
    expect(passesDuplicateQualityBar(pari(80, ["similar_title", "same_region"]))).toBe(false)
  })

  it("ei paasta lapi alle 70 pisteen paria", () => {
    expect(passesDuplicateQualityBar(pari(69, ["exact_title", "same_city"]))).toBe(false)
  })

  /*
   * Mitattu 1.9.2026: kaista ">=70 ja name_in_description" on 47 paria,
   * ja se jakautuu jyrkasti. Kymmenen 95+ paria olivat kaikki aitoja
   * (sama tuulipuisto YVA:na ja osayleiskaavana), 70-78 enimmakseen eri
   * hankkeita.
   */
  it("hyvaksyy kuvaustodisteen vasta 95 pisteesta", () => {
    expect(
      passesDuplicateQualityBar(pari(100, ["name_in_description", "same_city"]))
    ).toBe(true)
    expect(
      passesDuplicateQualityBar(pari(95, ["name_in_description", "same_city"]))
    ).toBe(true)
  })

  it("ei hyvaksy kuvaustodistetta matalilla pisteilla", () => {
    for (const pisteet of [70, 78, 94]) {
      expect(
        passesDuplicateQualityBar(pari(pisteet, ["name_in_description", "same_city"]))
      ).toBe(false)
    }
  })

  it("vaatii kuvaustodisteeltakin saman kaupungin", () => {
    expect(
      passesDuplicateQualityBar(pari(100, ["name_in_description", "same_region"]))
    ).toBe(false)
  })
})
