import { describe, it, expect } from "vitest"
import { scoreOpportunity } from "./todayRanking"
import type { TodaySettings } from "./getTodaySettings"

// Rakennetaan asetukset paikallisesti — getTodaySettings.ts alustaa Supabase-
// clientin moduulitasolla (vaatisi env-muuttujat testissä).
const baseSettings: TodaySettings = {
  regions: [],
  municipalities: [],
  projectStages: [],
  constructionTypes: [],
  buildingTypes: [],
  bestSalesMoments: [],
  sources: [],
  keywords: [],
  maxProjects: 20,
  showRejected: false,
  showArchived: false,
  companyProfile: null,
}

function settings(overrides: Partial<TodaySettings>): TodaySettings {
  return { ...baseSettings, ...overrides }
}

function tradeItem(result: ReturnType<typeof scoreOpportunity>) {
  return result.breakdown.find((b) => b.module === "tradeKeywordFit")
}

describe("tradeKeywordFit", () => {
  it("antaa pisteet + selityksen kun avainsana osuu hankkeen tekstiin", () => {
    const project = {
      name: "Sähköurakka kouluun",
      metadata: { description: "Kohteeseen tehdään sähköistys ja valaistus." },
      created_at: "2020-01-01",
    }

    const result = scoreOpportunity(
      project,
      settings({ keywords: ["sähkö", "valaistus"] })
    )
    const item = tradeItem(result)

    expect(item?.points).toBeGreaterThan(0)
    expect(item?.reason).toMatch(/mainittu/)
  })

  it("ei vaikuta kun avainsanoja ei ole asetettu (fail-open)", () => {
    const project = { name: "Sähköurakka kouluun", created_at: "2020-01-01" }

    const item = tradeItem(scoreOpportunity(project, settings({ keywords: [] })))

    expect(item?.points).toBe(0)
    expect(item?.reason).toBeUndefined()
  })

  it("ei osu kun avainsanaa ei mainita", () => {
    const project = {
      name: "Päiväkodin piha-alueen kunnostus",
      metadata: { description: "Leikkivälineet ja istutukset." },
      created_at: "2020-01-01",
    }

    const item = tradeItem(
      scoreOpportunity(project, settings({ keywords: ["sähkö"] }))
    )

    expect(item?.points).toBe(0)
  })

  it("lyhyt avainsana (LVI) ei osu yhdyssanan sisään", () => {
    // "LVI" ei saa osua esim. sanaan 'palvipuu'; vaatii sananrajan.
    const noMatch = {
      name: "Palvelukeskuksen laajennus",
      created_at: "2020-01-01",
    }
    const match = {
      name: "LVI-saneeraus kerrostaloon",
      created_at: "2020-01-01",
    }

    expect(
      tradeItem(scoreOpportunity(noMatch, settings({ keywords: ["LVI"] })))
        ?.points
    ).toBe(0)
    expect(
      tradeItem(scoreOpportunity(match, settings({ keywords: ["LVI"] })))
        ?.points
    ).toBeGreaterThan(0)
  })

  it("useampi osuma antaa enemmän pisteitä (kattoon asti)", () => {
    const project = {
      name: "Sähkö, valaistus ja sähköistys",
      metadata: { description: "sähkö valaistus sähköistys putki ilmanvaihto" },
      created_at: "2020-01-01",
    }

    const one = tradeItem(
      scoreOpportunity(project, settings({ keywords: ["sähkö"] }))
    )!
    const many = tradeItem(
      scoreOpportunity(
        project,
        settings({ keywords: ["sähkö", "valaistus", "putki", "ilmanvaihto"] })
      )
    )!

    expect(many.points).toBeGreaterThan(one.points)
    expect(many.points).toBeLessThanOrEqual(25)
  })
})
