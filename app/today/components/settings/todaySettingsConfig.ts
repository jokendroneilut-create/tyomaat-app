import { CANONICAL_PHASES } from "@/lib/projects/phases"

/*
 * Roolivalikko. "Muu" on VIIMEINEN vaihtoehto eikä oletus: mitattuna
 * 15.8.2026 puolet tileistä (13/26) oli siinä, ja syy oli listan aukko eikä
 * käyttäjän haluttomuus — verkkotunnukset paljastivat henkilöstövuokrausta,
 * erikoisurakointia, konevuokrausta ja mittauspalvelua. Nämä neljä lisättiin.
 * Roolien nimien on vastattava `lib/opportunity/roleStageMatrix.ts`:n avaimia,
 * muuten rooli valuu takaisin painottomaksi. Ks. D-071.
 */
export const companyProfiles = [
  "Aliurakointi",
  "Arkkitehti",
  "Henkilöstövuokraus",
  "Infra",
  "Kiinteistönomistaja",
  "Konevuokraus",
  "Konsultti",
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
  "Hilma",
  "Kaavoitus",
  "Kuntapäätökset",
  "Rakennusluvat",
  "Yritysuutiset",
  "Ympäristö & YVA",
  "Suunnittelukilpailut",
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
  keywords: string[]
  opportunityAlerts: boolean
  maxProjects: number
}