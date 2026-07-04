import { buildingTypes } from "../knowledge/buildingTypes"
import { projectStages } from "../knowledge/projectStages"
import { companies } from "../knowledge/companies"

export type ExtractedCompany = {
  name: string
  role: string
  confidence: number
}

export type ExtractedEntities = {
  companies: ExtractedCompany[]
  buildingTypes: string[]
  projectStages: string[]
  money: string[]
  areas: string[]
  dates: string[]
}

function includesFlexible(text: string, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase()
  return (
    text.includes(normalizedKeyword) ||
    text.includes(normalizedKeyword.slice(0, -1))
  )
}

export function extractEntities(text: string): ExtractedEntities {
  const normalized = text.toLowerCase()

  const buildingTypeMatches = buildingTypes
    .filter((item) => includesFlexible(normalized, item.keyword))
    .map((item) => item.keyword)

  const stageMatches = projectStages
    .filter((item) => includesFlexible(normalized, item.keyword))
    .map((item) => item.stage)

  const companyMatches = companies
    .filter((company) => {
      const names = [company.name, ...(company.aliases ?? [])]

      return names.some((name) =>
        normalized.includes(name.toLowerCase())
      )
    })
    .map((company) => ({
      name: company.name,
      role: company.role,
      confidence: company.confidence,
    }))

  const moneyMatches =
    text.match(/\d+(?:[.,]\d+)?\s?(?:M€|miljoonaa|milj\.)/gi) ?? []

  const areaMatches =
    text.match(/\d+(?:[.,]\d+)?\s?(?:m²|m2|kem²|k-m²)/gi) ?? []

  return {
    companies: companyMatches,
    buildingTypes: [...new Set(buildingTypeMatches)],
    projectStages: [...new Set(stageMatches)],
    money: [...new Set(moneyMatches)],
    areas: [...new Set(areaMatches)],
    dates: [],
  }
}