import { CANONICAL_PHASES } from "@/lib/projects/phases"

export const companyProfiles = [
  "Rakennusliike",
  "Talotekniikka",
  "Sähköurakoitsija",
  "Rakennustuotteet",
  "Arkkitehti",
  "Rakennesuunnittelu",
  "Infra",
  "Kiinteistönomistaja",
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
  "Uusimaa",
  "Varsinais-Suomi",
  "Satakunta",
  "Kanta-Häme",
  "Pirkanmaa",
  "Päijät-Häme",
  "Kymenlaakso",
  "Etelä-Karjala",
  "Etelä-Savo",
  "Pohjois-Savo",
  "Pohjois-Karjala",
  "Keski-Suomi",
  "Etelä-Pohjanmaa",
  "Pohjanmaa",
  "Keski-Pohjanmaa",
  "Pohjois-Pohjanmaa",
  "Kainuu",
  "Lappi",
  "Ahvenanmaa",
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