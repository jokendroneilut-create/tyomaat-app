import { buildingTypes } from "../knowledge/buildingTypes"
import { projectStages } from "../knowledge/projectStages"

export type ExtractedEntities = {
  companies: string[]
  buildingTypes: string[]
  projectStages: string[]
  money: string[]
  areas: string[]
  dates: string[]
}

export function extractEntities(text: string): ExtractedEntities {
  const normalized = text.toLowerCase()

  const buildingTypeMatches = buildingTypes
    .filter((item) => {
  const keyword = item.keyword.toLowerCase()
  return normalized.includes(keyword) || normalized.includes(keyword.slice(0, -1))
})
    .map(item => item.keyword)

  const stageMatches = projectStages
    .filter((item) => {
  const keyword = item.keyword.toLowerCase()
  return normalized.includes(keyword) || normalized.includes(keyword.slice(0, -1))
})
    .map(item => item.stage)

  const moneyMatches =
    text.match(/\d+(?:[.,]\d+)?\s?(?:M€|miljoonaa|milj\.)/gi) ?? []

  const areaMatches =
    text.match(/\d+(?:[.,]\d+)?\s?(?:m²|m2|kem²|k-m²)/gi) ?? []

  return {
    companies: [],
    buildingTypes: [...new Set(buildingTypeMatches)],
    projectStages: [...new Set(stageMatches)],
    money: [...new Set(moneyMatches)],
    areas: [...new Set(areaMatches)],
    dates: [],
  }
}