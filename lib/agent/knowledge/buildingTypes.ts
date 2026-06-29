export type BuildingTypeKnowledge = {
  keyword: string
  category: "public" | "residential" | "commercial" | "industrial" | "infrastructure" | "low_value"
  businessValue: number
  reason: string
}

export const buildingTypes: BuildingTypeKnowledge[] = [
  {
    keyword: "datakeskus",
    category: "industrial",
    businessValue: 95,
    reason: "Datakeskushankkeet ovat yleensä suuria ja korkean arvon rakennushankkeita",
  },
  {
    keyword: "logistiikkakeskus",
    category: "industrial",
    businessValue: 85,
    reason: "Logistiikkakeskukset ovat usein suuria toimitila- ja teollisuushankkeita",
  },
  {
    keyword: "koulu",
    category: "public",
    businessValue: 80,
    reason: "Kouluhankkeet ovat julkisia ja usein merkittäviä rakennushankkeita",
  },
  {
    keyword: "päiväkoti",
    category: "public",
    businessValue: 75,
    reason: "Päiväkotihankkeet ovat julkisia rakennushankkeita",
  },
  {
    keyword: "kerrostalo",
    category: "residential",
    businessValue: 75,
    reason: "Kerrostalohankkeet ovat yleensä relevantteja rakennushankkeita",
  },
  {
    keyword: "toimitila",
    category: "commercial",
    businessValue: 70,
    reason: "Toimitilahankkeet ovat usein kaupallisesti relevantteja",
  },
  {
    keyword: "omakotitalo",
    category: "low_value",
    businessValue: 5,
    reason: "Yksittäiset omakotitalot eivät yleensä kuulu Työmaat.fi:n ydinkohderyhmään",
  },
  {
    keyword: "terassi",
    category: "low_value",
    businessValue: 2,
    reason: "Terassit ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "autotalli",
    category: "low_value",
    businessValue: 3,
    reason: "Autotallit ovat yleensä pieniä yksityisiä kohteita",
  },
]