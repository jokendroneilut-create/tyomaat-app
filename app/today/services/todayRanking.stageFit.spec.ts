import { describe, it, expect } from "vitest"
import { scoreOpportunity } from "./todayRanking"
import type { TodaySettings } from "./getTodaySettings"

/*
 * Vaihepisteytys pisteytysketjun läpi (D-071). Yksikkötestit
 * `lib/opportunity/opportunity.spec.ts`:ssä todistavat painot; tämä todistaa
 * että ne päätyvät pisteiksi ja selitykseksi asti — juuri se ketju joka oli
 * poikki "Muu"-roolilla.
 *
 * Asetukset rakennetaan paikallisesti: getTodaySettings.ts alustaa Supabase-
 * clientin moduulitasolla.
 */
const baseSettings: TodaySettings = {
  regions: [],
  municipalities: [],
  projectStages: [],
  constructionTypes: [],
  buildingTypes: [],
  bestSalesMoments: [],
  keywords: [],
  maxProjects: 20,
  showRejected: false,
  showArchived: false,
  companyProfile: null,
  opportunityAlerts: true,
  teamModeInToday: false,
  hideTeammateOwned: true,
}

function settings(overrides: Partial<TodaySettings>): TodaySettings {
  return { ...baseSettings, ...overrides }
}

function item(result: ReturnType<typeof scoreOpportunity>, module: string) {
  return result.breakdown.find((b) => b.module === module)
}

// Vanha hanke ilman business_valuea: vaihepisteytys eristyy muista moduuleista.
const construction = { phase: "Rakenteilla", created_at: "2020-01-01", metadata: {} }

describe("roleStageFit ilman roolia", () => {
  it("'Muu' + omat myyntihetket antaa pisteet ja selittää mistä ne tulevat", () => {
    const result = scoreOpportunity(
      construction,
      settings({ companyProfile: "Muu", bestSalesMoments: ["Rakenteilla"] })
    )
    const stage = item(result, "roleStageFit")!

    expect(stage.points).toBeGreaterThan(0)
    expect(stage.reason).toBe("Rakenteilla — valitsemasi myyntihetki")
  })

  it("sama signaali ei kelpaa kahdesti: myyntihetkimoduuli vaikenee", () => {
    const result = scoreOpportunity(
      construction,
      settings({ companyProfile: "Muu", bestSalesMoments: ["Rakenteilla"] })
    )

    expect(item(result, "salesMomentFit")!.points).toBe(0)
  })

  it("'Muu' ilman myyntihetkiä saa mitatun oletuksen, ei nollaa", () => {
    const result = scoreOpportunity(
      construction,
      settings({ companyProfile: "Muu" })
    )
    const stage = item(result, "roleStageFit")!

    expect(stage.points).toBeGreaterThan(0)
    expect(stage.reason).toBe("Rakenteilla — tyypillinen myyntihetki")
  })

  it("väärä vaihe ei saa pisteitä vaikka rooli puuttuu", () => {
    const zoning = { phase: "Kaavoitus", created_at: "2020-01-01", metadata: {} }
    const result = scoreOpportunity(
      zoning,
      settings({ companyProfile: "Muu", bestSalesMoments: ["Rakenteilla"] })
    )

    expect(item(result, "roleStageFit")!.points).toBe(0)
  })
})

describe("roleStageFit roolilla", () => {
  it("ilmoitettu rooli säilyttää oman selityksensä", () => {
    const result = scoreOpportunity(
      construction,
      settings({ companyProfile: "Rakennustuotteet" })
    )
    const stage = item(result, "roleStageFit")!

    expect(stage.points).toBe(40)
    expect(stage.reason).toBe("Rakenteilla — sopii materiaalitoimittajalle")
  })

  it("rooli pisteyttää vahvemmin kuin pääteltu signaali", () => {
    const withRole = scoreOpportunity(
      construction,
      settings({ companyProfile: "Rakennustuotteet" })
    )
    const inferred = scoreOpportunity(
      construction,
      settings({ companyProfile: "Muu", bestSalesMoments: ["Rakenteilla"] })
    )

    expect(item(withRole, "roleStageFit")!.points).toBeGreaterThan(
      item(inferred, "roleStageFit")!.points
    )
  })
})

describe("salesMomentFit kanonisella vaiheella", () => {
  /*
   * Aiempi substring-versio tunnisti viisi vaihetta yhdeksästä. Nämä kaksi
   * ovat niitä joita se ei tunnistanut — molemmat ovat käyttäjien valitsemia.
   */
  it("tunnistaa 'Sopimus myönnetty' ja 'Valmistumassa'", () => {
    const awarded = scoreOpportunity(
      { phase: "Sopimus myönnetty", created_at: "2020-01-01", metadata: {} },
      settings({ companyProfile: "Infra", bestSalesMoments: ["Sopimus myönnetty"] })
    )
    const nearing = scoreOpportunity(
      { phase: "Valmistumassa", created_at: "2020-01-01", metadata: {} },
      settings({ companyProfile: "Infra", bestSalesMoments: ["Valmistumassa"] })
    )

    expect(item(awarded, "salesMomentFit")!.points).toBeGreaterThan(0)
    expect(item(nearing, "salesMomentFit")!.points).toBeGreaterThan(0)
  })

  it("ei osu kun vaihe on eri", () => {
    const result = scoreOpportunity(
      construction,
      settings({ companyProfile: "Infra", bestSalesMoments: ["Kaavoitus"] })
    )

    expect(item(result, "salesMomentFit")!.points).toBe(0)
  })
})
