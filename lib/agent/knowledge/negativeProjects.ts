export type NegativeProjectKnowledge = {
  keyword: string
  severity: "low" | "medium" | "high"
  reason: string
}

export const negativeProjects: NegativeProjectKnowledge[] = [
  {
    keyword: "omakotitalo",
    severity: "high",
    reason: "Yksittäiset omakotitalot eivät yleensä kuulu Työmaat.fi:n kohderyhmään",
  },
  {
    keyword: "autotalli",
    severity: "high",
    reason: "Autotallit ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "autokatos",
    severity: "high",
    reason: "Autokatokset ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "terassi",
    severity: "high",
    reason: "Terassit ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "sauna",
    severity: "high",
    reason: "Saunat ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "piharakennus",
    severity: "high",
    reason: "Piharakennukset ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "varasto",
    severity: "medium",
    reason: "Varastot voivat olla pieniä kohteita, ellei kyse ole hallista tai logistiikkarakennuksesta",
  },
  {
    keyword: "julkisivuremontti",
    severity: "medium",
    reason: "Julkisivuremontit ovat usein korjaushankkeita, eivät uusia rakennusmahdollisuuksia",
  },
  {
    keyword: "ikkunaremontti",
    severity: "medium",
    reason: "Ikkunaremontit ovat yleensä rajattuja korjaushankkeita",
  },
  {
    keyword: "kattoremontti",
    severity: "medium",
    reason: "Kattoremontit ovat yleensä rajattuja korjaushankkeita",
  }
]