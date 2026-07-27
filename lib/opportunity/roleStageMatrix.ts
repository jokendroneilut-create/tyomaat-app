import type { PhaseKey } from "@/lib/projects/phases"

/*
 * Rooli → elinkaaren vaihe -relevanssimatriisi (P1 Opportunity Engine, §2).
 *
 * Kunkin roolin "myyntihetki" johdetaan hankkeen kanonisesta vaiheesta
 * (`PhaseKey`) painoilla: huippuvaihe = 1.0, viereiset = osittainen. Logiikka:
 * mitä myöhempi rooli arvoketjussa, sitä myöhempi vaihe on relevantti —
 * arkkitehti kaavassa, materiaalitoimittaja rakentamisessa.
 *
 * Tämä on TARKOITUKSELLA yksi tarkistettava taulukko: kaikki roolikohtainen
 * pisteytyslogiikka on tässä, ei hajautettuna. Säädä painoja käyttäjäpalautteen
 * mukaan. Roolien nimet vastaavat `todaySettingsConfig.ts`:n `companyProfiles`.
 */

export type StageWeights = Partial<Record<PhaseKey, number>>

export const ROLE_STAGE_MATRIX: Record<string, StageWeights> = {
  Arkkitehti: { idea: 1.0, zoning: 1.0, planning: 0.8 },
  Kiinteistönomistaja: { idea: 1.0, zoning: 0.8, planning: 0.6 },
  Rakennesuunnittelu: { planning: 1.0, permit: 0.8 },
  Rakennusliike: { tender: 1.0, permit: 0.6, contract_awarded: 0.4 },
  Infra: { zoning: 0.4, tender: 1.0, construction: 0.7 },
  Sähköurakoitsija: { contract_awarded: 1.0, tender: 0.7, construction: 0.6 },
  Talotekniikka: { contract_awarded: 1.0, tender: 0.7, construction: 0.6 },
  Rakennustuotteet: {
    contract_awarded: 0.8,
    construction: 1.0,
    nearing_completion: 0.5,
  },
  Muu: {},
}

/*
 * Roolin datiivimuoto selitystekstiä varten ("… sopii materiaalitoimittajalle").
 */
export const ROLE_DATIVE_LABEL: Record<string, string> = {
  Arkkitehti: "arkkitehdille",
  Kiinteistönomistaja: "kiinteistönomistajalle",
  Rakennesuunnittelu: "rakennesuunnittelijalle",
  Rakennusliike: "rakennusliikkeelle",
  Infra: "infrarakentajalle",
  Sähköurakoitsija: "sähköurakoitsijalle",
  Talotekniikka: "talotekniikkaurakoitsijalle",
  Rakennustuotteet: "materiaalitoimittajalle",
  Muu: "sinulle",
}

/*
 * Palauttaa (rooli, vaihe) -painon [0..1] tai 0 jos ei relevantti / ei roolia /
 * tuntematon vaihe.
 */
export function roleStageWeight(
  companyProfile: string | null | undefined,
  phaseKey: PhaseKey | null
): number {
  if (!companyProfile || !phaseKey) return 0
  return ROLE_STAGE_MATRIX[companyProfile]?.[phaseKey] ?? 0
}
