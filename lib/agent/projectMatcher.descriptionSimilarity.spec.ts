import { describe, it, expect } from "vitest"
import { calculateMatch, type MatchableProject } from "./projectMatcher"

const forssaDataCenter: MatchableProject = {
  id: "forssa-dc",
  name: "Datakeskus Forssaan",
  city: "Forssa",
  region: "Kanta-Häme",
  location: "Forssa, Ratasmäki (Masmalankatu 1)",
  phase: "Rakennuslupa",
  developer: "Green 3 Finland Oy",
  property_type: "Datakeskus",
  additional_info:
    "Green 3 Finland Oy rakennuttaa Forssan Ratasmäkeen datakeskuksen. Yhdeksän datasalia, 60 000 neliötä, 81 megawattia, teräsrunkoinen rakennus.",
  metadata: {},
}

describe("descriptionSimilarity matching", () => {
  it("yhdistää valmistumisuutisen samaan datakeskushankkeeseen kuvauksen ja kaupungin perusteella", () => {
    const completionNews = {
      name: "Green 3:n datakeskus valmistui Forssaan",
      city: "Forssa",
      developer: "Green 3 Finland Oy",
      description:
        "Green 3 Finland Oy:n Forssan Ratasmäen datakeskus valmistui. Yhdeksän datasalia ja 81 megawatin teho otettiin käyttöön teräsrunkoisessa rakennuksessa.",
    }

    const match = calculateMatch(forssaDataCenter, completionNews)
    expect(match).not.toBeNull()
    expect(match!.confidence).toBeGreaterThanOrEqual(70)
    expect(match!.reasons).toContain("similar_description")
  })

  it("EI yhdistä eri kaupungin eri hanketta vaikka kuvaus olisi geneerisesti samankaltainen", () => {
    const otherCityDataCenter = {
      name: "Datakeskus Ouluun",
      city: "Oulu",
      developer: "Toinen Yhtiö Oy",
      description:
        "Yhtiö rakennuttaa Ouluun datakeskuksen. Useita datasaleja, teräsrunkoinen rakennus, korkea sähköteho.",
    }

    const match = calculateMatch(forssaDataCenter, otherCityDataCenter)
    // eri kaupunki + eri rakennuttaja -> ei saa yhdistyä pelkän kuvauskohinan takia
    expect(match?.confidence ?? 0).toBeLessThan(70)
  })
})
