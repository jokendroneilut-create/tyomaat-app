export type CompanyRole =
  | "developer"
  | "contractor"
  | "designer"
  | "consultant"
  | "supplier"
  | "owner"

export type CompanyKnowledge = {
  name: string
  aliases?: string[]
  role: CompanyRole
  description: string

  confidence: number
}

export const companies: CompanyKnowledge[] = [
  {
    name: "YIT",
    role: "contractor",
    description: "Suuri rakennusliike",
    confidence: 100,
  },

  {
    name: "Skanska",
    role: "contractor",
    description: "Suuri rakennusliike",
    confidence: 100,
  },

  {
    name: "NCC",
    role: "contractor",
    description: "Suuri rakennusliike",
    confidence: 100,
  },

  {
    name: "SRV",
    role: "contractor",
    description: "Suuri rakennusliike",
    confidence: 100,
  },

  {
    name: "Kreate",
    role: "contractor",
    description: "Infraurakoitsija",
    confidence: 100,
  },

  {
    name: "GRK",
    role: "contractor",
    description: "Infraurakoitsija",
    confidence: 100,
  },

  {
    name: "Destia",
    role: "contractor",
    description: "Infraurakoitsija",
    confidence: 100,
  },

  {
    name: "Sweco",
    role: "designer",
    description: "Suunnittelu- ja konsultointiyritys",
    confidence: 100,
  },

  {
    name: "Sitowise",
    role: "designer",
    description: "Suunnittelu- ja konsultointiyritys",
    confidence: 100,
  },

  {
    name: "Ramboll",
    role: "designer",
    description: "Suunnittelu- ja konsultointiyritys",
    confidence: 100,
  },

  {
    name: "AFRY",
    role: "designer",
    description: "Suunnittelu- ja konsultointiyritys",
    confidence: 100,
  },

  {
    name: "Cibus Nordic Real Estate AB",
    aliases: ["Cibus"],
    role: "developer",
    description: "Kiinteistösijoittaja, joka rakennuttaa usein Lidl-myymälöitä.",
    confidence: 95,
  },
]