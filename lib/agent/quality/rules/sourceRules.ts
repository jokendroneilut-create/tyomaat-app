export type SourceRule = {
  source: string
  points: number
 reason: string
}

export const sourceRules: SourceRule[] = [
  {
    source: "hilma",
    points: 30,
    reason: "Julkinen hankintailmoitus",
  },
  {
    source: "rakennusvalvonta",
    points: 25,
    reason: "Rakennusvalvonnan lähde",
  },
  {
    source: "rakennuslupa",
    points: 25,
    reason: "Rakennuslupaan liittyvä tieto",
  },
  {
    source: "stt",
    points: 10,
    reason: "Luotettava uutislähde",
  },
  {
    source: "kaupunki",
    points: 5,
    reason: "Kunnan tiedotus",
  },
  {
    source: "kunta",
    points: 5,
    reason: "Kunnan tiedotus",
  },
]