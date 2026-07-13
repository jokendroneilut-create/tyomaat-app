import { CANONICAL_PHASES } from "@/lib/projects/phases"

export const companyProfiles = [
  "Arkkitehti",
  "Infra",
  "Kiinteistönomistaja",
  "Rakennesuunnittelu",
  "Rakennusliike",
  "Rakennustuotteet",
  "Sähköurakoitsija",
  "Talotekniikka",
  "Muu",
] as const

export const salesMoments = CANONICAL_PHASES.filter((p) => !p.terminal).map(
  (p) => p.label
)

export const todaySources = [
  "Rakennusluvat",
  "Hilma",
  "Kaavoitus",
  "Kuntapäätökset",
  "Yritysuutiset",
] as const

export const regions = [
  "Etelä-Karjala",
  "Etelä-Pohjanmaa",
  "Etelä-Savo",
  "Kainuu",
  "Kanta-Häme",
  "Keski-Pohjanmaa",
  "Keski-Suomi",
  "Kymenlaakso",
  "Lappi",
  "Pirkanmaa",
  "Pohjanmaa",
  "Pohjois-Karjala",
  "Pohjois-Pohjanmaa",
  "Pohjois-Savo",
  "Päijät-Häme",
  "Satakunta",
  "Uusimaa",
  "Varsinais-Suomi",
] as const

export const maxProjectOptions = [20, 40, 60, 100] as const

export type TodaySettingsFormState = {
  companyProfile: string | null
  wholeFinland: boolean
  selectedRegions: string[]
  selectedSalesMoments: string[]
  selectedSources: string[]
  maxProjects: number
}