export type CompanyRelationship = {
  company: string
  aliases?: string[]
  relatedCompany: string
  relationshipType:
  | "likely_tenant"
  | "possible_tenant"
  | "tenant"
  | "partner"
  | "common_customer"
  | "owner"
  | "developer"
  description: string
  confidence: number
}

export const companyRelationships: CompanyRelationship[] = [
  {
    company: "Cibus Nordic Real Estate AB",
    aliases: ["Cibus", "Cibus Nordic Real Estate", "Cibus Real Estate"],
    relatedCompany: "Lidl",
    relationshipType: "likely_tenant",
    description:
      "Cibus omistaa ja hallinnoi päivittäistavarakauppakiinteistöjä, joissa Lidl voi toimia pitkäaikaisena vuokralaisena.",
    confidence: 80,
  },
  {
    company: "Cibus Nordic Real Estate AB",
    aliases: ["Cibus", "Cibus Nordic Real Estate", "Cibus Real Estate"],
    relatedCompany: "Tokmanni",
    relationshipType: "possible_tenant",
    description:
      "Cibus voi omistaa päivittäistavarakauppa- tai retail-kiinteistöjä, joissa Tokmanni voi olla vuokralaisena.",
    confidence: 55,
  },
  {
    company: "Cibus Nordic Real Estate AB",
    aliases: ["Cibus", "Cibus Nordic Real Estate", "Cibus Real Estate"],
    relatedCompany: "Kesko",
    relationshipType: "possible_tenant",
    description:
      "Cibus voi omistaa päivittäistavarakauppakiinteistöjä, joissa Kesko tai K-ryhmän toimija voi olla vuokralaisena.",
    confidence: 55,
  },
]