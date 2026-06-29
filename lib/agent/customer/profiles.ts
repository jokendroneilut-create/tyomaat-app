export type CustomerProfile = {
  id: string
  name: string
  description: string
  preferredStages: string[]
  preferredContactRoles: string[]
  preferredProjectTypes: string[]
  minimumProjectSize: "small" | "medium" | "large" | "very_large"
}

export const customerProfiles: CustomerProfile[] = [
  {
    id: "equipment_rental",
    name: "Konevuokraamot",
    description: "Yritykset, jotka vuokraavat työmaakoneita ja kalustoa.",
    preferredStages: ["construction", "contract_awarded"],
    preferredContactRoles: ["project_manager", "site_manager", "work_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "infrastructure", "residential"],
    minimumProjectSize: "medium",
  },
  {
    id: "construction_companies",
    name: "Rakennusliikkeet",
    description: "Pääurakoitsijat ja rakennusliikkeet kuten YIT, Skanska, Kreate, NCC ja SRV.",
    preferredStages: ["planning", "zoning", "permit", "tender"],
    preferredContactRoles: ["developer", "procurement_manager", "project_owner"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential", "infrastructure"],
    minimumProjectSize: "large",
  },
  {
    id: "earthworks",
    name: "Maarakennus",
    description: "Maanrakennus-, pohjarakennus- ja infratoimijat.",
    preferredStages: ["permit", "tender", "construction"],
    preferredContactRoles: ["project_manager", "procurement_manager", "site_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "infrastructure"],
    minimumProjectSize: "medium",
  },
  {
    id: "concrete_suppliers",
    name: "Betoni ja elementit",
    description: "Betonin, betonielementtien ja runkoratkaisujen toimittajat.",
    preferredStages: ["tender", "contract_awarded"],
    preferredContactRoles: ["procurement_manager", "project_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential"],
    minimumProjectSize: "large",
  },
  {
    id: "hvac_contractors",
    name: "LVI-urakoitsijat",
    description: "LVI-, ilmanvaihto- ja talotekniikkaurakoitsijat.",
    preferredStages: ["tender", "contract_awarded", "construction"],
    preferredContactRoles: ["project_manager", "procurement_manager", "technical_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential"],
    minimumProjectSize: "medium",
  },
  {
    id: "electrical_contractors",
    name: "Sähköurakoitsijat",
    description: "Sähkö-, automaatio- ja valaistusurakoitsijat.",
    preferredStages: ["tender", "contract_awarded", "construction"],
    preferredContactRoles: ["project_manager", "procurement_manager", "technical_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential"],
    minimumProjectSize: "medium",
  },
  {
    id: "structural_designers",
    name: "Rakennesuunnittelu",
    description: "Rakennesuunnittelutoimistot ja tekniset konsultit.",
    preferredStages: ["idea", "planning", "zoning", "permit"],
    preferredContactRoles: ["developer", "project_owner", "architect"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential"],
    minimumProjectSize: "medium",
  },
  {
    id: "architects",
    name: "Arkkitehtitoimistot",
    description: "Arkkitehdit ja pääsuunnittelijat.",
    preferredStages: ["idea", "planning", "zoning"],
    preferredContactRoles: ["developer", "project_owner", "city_planning"],
    preferredProjectTypes: ["commercial", "public", "residential", "industrial"],
    minimumProjectSize: "medium",
  },
  {
    id: "building_materials",
    name: "Rakennusmateriaalit",
    description: "Rakennusmateriaalien, tuotteiden ja järjestelmien toimittajat.",
    preferredStages: ["tender", "contract_awarded", "construction"],
    preferredContactRoles: ["procurement_manager", "project_manager"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential"],
    minimumProjectSize: "medium",
  },
  {
    id: "construction_consultants",
    name: "Rakennuttajakonsultit",
    description: "Rakennuttamisen, valvonnan ja projektinjohdon konsultit.",
    preferredStages: ["idea", "planning", "zoning", "permit"],
    preferredContactRoles: ["developer", "project_owner", "municipality"],
    preferredProjectTypes: ["industrial", "commercial", "public", "residential", "infrastructure"],
    minimumProjectSize: "medium",
  },
]