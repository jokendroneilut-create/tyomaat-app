import { describe, expect, it } from "vitest"

import { muotoileKenttaArvo, muotoileLuku, RYHMITTELYN_KYNNYS } from "./luvut"

/* fi-FI ryhmaerotin on sitkea valilyonti; testit vertaavat sita vasten. */
const V = " "

describe("muotoileLuku", () => {
  it("ryhmittelee kolmen numeron ryhmiin", () => {
    expect(muotoileLuku(20000000)).toBe(`20${V}000${V}000`)
    expect(muotoileLuku(900000000)).toBe(`900${V}000${V}000`)
    expect(muotoileLuku(200000)).toBe(`200${V}000`)
  })

  it("katkaisee desimaalit kahteen", () => {
    /* site_area_m2 oli kannassa muodossa 2493032.648007 */
    expect(muotoileLuku(2493032.648007)).toBe(`2${V}493${V}032,65`)
  })
})

describe("muotoileKenttaArvo", () => {
  it("muotoilee kustannusarvion", () => {
    /*
     * Tama oli se havainto: luku oli poimittu oikein ("kustannusarvio
     * on n. 20 M€"), mutta sivu tulosti sen muodossa 20000000.
     */
    expect(muotoileKenttaArvo("estimated_cost", 20000000)).toBe(`20${V}000${V}000`)
    expect(muotoileKenttaArvo("contract_value", 646000000)).toBe(`646${V}000${V}000`)
    expect(muotoileKenttaArvo("floor_area", 200000)).toBe(`200${V}000`)
  })

  it("EI muotoile vuosilukua", () => {
    /*
     * design_start_year on jonossa numero 2018-2025. Tuhaterotin tekisi
     * siita "2 025". Kynnys suojaa sen ilman erillista luetteloa, koska
     * vuosiluku ei ylita 9 999:aa.
     */
    expect(muotoileKenttaArvo("design_start_year", 2025)).toBe("2025")
    expect(RYHMITTELYN_KYNNYS).toBeGreaterThan(2025)
  })

  it("EI muotoile varmuuslukua, kappalemaaraa eika laskuria", () => {
    expect(muotoileKenttaArvo("classification_confidence", 88)).toBe("88")
    expect(muotoileKenttaArvo("building_type_confidence", 0.99)).toBe("0.99")
    expect(muotoileKenttaArvo("apartments", 981)).toBe("981")
    expect(muotoileKenttaArvo("fact_count", 9)).toBe("9")
  })

  it("EI muotoile tunnistetta vaikka se olisi iso numero", () => {
    /*
     * Jonossa nama ovat merkkijonoja, mutta uusi lahde voi tuoda saman
     * kentan numerona - ja silloin "59 259" olisi vaarin.
     */
    expect(muotoileKenttaArvo("notice_id", 59259)).toBe("59259")
    expect(muotoileKenttaArvo("procedure_id", 38561)).toBe("38561")
    expect(muotoileKenttaArvo("permit_number", 2026059259)).toBe("2026059259")
    expect(muotoileKenttaArvo("cpv_code", 45000000)).toBe("45000000")
  })

  it("palauttaa merkkijonot ja tyhjat arvot ennallaan", () => {
    expect(muotoileKenttaArvo("urakkamuoto", "KVR")).toBe("KVR")
    expect(muotoileKenttaArvo("estimated_cost", null)).toBe("null")
    expect(muotoileKenttaArvo("estimated_cost", Number.NaN)).toBe("NaN")
  })
})
