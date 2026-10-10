import { describe, it, expect } from "vitest"
import { parseRealizedLocation } from "./hilmaRealizedLocation"

function eForm(address: any) {
  return { procurementProject: { realizedLocation: [{ address }] } }
}

/*
 * Suorituspaikan maa (D-265). Rakenne on Hilman oikeasta vastauksesta
 * 11.10.2026 (Venetsian Pohjoismaiden paviljonki).
 */
describe("parseRealizedLocation: maa", () => {
  it("lukee ulkomaisen suorituspaikan", () => {
    const r = parseRealizedLocation(
      eForm({
        streetName: { value: "Giardini della Biennale" },
        cityName: { value: "Venice" },
        country: { identificationCode: { value: "ITA" } },
      })
    )
    expect(r.country).toBe("ITA")
    expect(r.city).toBe("Venice")
  })

  it("lukee kotimaisen", () => {
    expect(
      parseRealizedLocation(
        eForm({ cityName: { value: "Jyväskylä" }, country: { identificationCode: { value: "FIN" } } })
      ).country
    ).toBe("FIN")
  })

  /*
   * TYHJA EI OLE ULKOMAA. Suurin osa ilmoituksista ei kerro maata, ja
   * jos puuttuva tulkittaisiin ulkomaaksi, kotimaiset hankkeet
   * katoaisivat jonosta.
   */
  it("palauttaa null kun maata ei kerrota", () => {
    expect(parseRealizedLocation(eForm({ cityName: { value: "Oulu" } })).country).toBeNull()
    expect(parseRealizedLocation(null).country).toBeNull()
  })

  /* Monen maan hankinnassa ei vaiteta mitaan. */
  it("palauttaa null kun maita on useita", () => {
    const r = parseRealizedLocation({
      procurementProject: {
        realizedLocation: [
          { address: { cityName: { value: "Oulu" }, country: { identificationCode: { value: "FIN" } } } },
          { address: { cityName: { value: "Venice" }, country: { identificationCode: { value: "ITA" } } } },
        ],
      },
    })
    expect(r.country).toBeNull()
  })
})
