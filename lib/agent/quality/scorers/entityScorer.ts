import { buildingTypes } from "../../knowledge/buildingTypes"

export type EntityScoreResult = {
  points: number
  reason: string
}

type CandidateEntities = {
  buildingTypes?: string[]
  projectStages?: string[]
}

export function scoreEntities(
  entities: CandidateEntities | null | undefined
): EntityScoreResult[] {
  if (!entities) return []

  const results: EntityScoreResult[] = []

  for (const buildingType of entities.buildingTypes ?? []) {
    const match = buildingTypes.find(
      (item) => item.keyword.toLowerCase() === buildingType.toLowerCase()
    )

    if (match) {
      results.push({
        points: Math.round(match.businessValue / 2),
        reason: `Rakennustyyppi tunnistettu: ${match.keyword}`,
      })
    }
  }

  for (const stage of entities.projectStages ?? []) {
    if (stage === "permit") {
      results.push({
        points: 20,
        reason: "Hanke on rakennuslupavaiheessa",
      })
    }

    if (stage === "tender") {
      results.push({
        points: 35,
        reason: "Hanke on tarjousvaiheessa",
      })
    }

    if (stage === "contract_awarded") {
      results.push({
        points: 30,
        reason: "Urakoitsija tai sopimus on valittu",
      })
    }

    if (stage === "construction") {
      results.push({
        points: 20,
        reason: "Rakentaminen on alkamassa tai käynnissä",
      })
    }

    if (stage === "cancelled") {
      results.push({
        points: -80,
        reason: "Hanke on mahdollisesti peruttu tai keskeytetty",
      })
    }
  }

  return results
}