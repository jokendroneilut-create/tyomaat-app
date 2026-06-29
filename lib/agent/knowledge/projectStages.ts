export type ProjectStage =
  | "idea"
  | "planning"
  | "zoning"
  | "permit"
  | "tender"
  | "contract_awarded"
  | "construction"
  | "completed"
  | "cancelled"

export type ProjectStageKnowledge = {
  keyword: string
  stage: ProjectStage
  reason: string
}

export const projectStages: ProjectStageKnowledge[] = [
  {
    keyword: "kaavaluonnos",
    stage: "zoning",
    reason: "Kaavaluonnos viittaa varhaiseen kaavoitusvaiheeseen",
  },
  {
    keyword: "asemakaava",
    stage: "zoning",
    reason: "Asemakaava viittaa kaavoitusvaiheeseen",
  },
  {
    keyword: "rakennuslupa",
    stage: "permit",
    reason: "Rakennuslupa viittaa lupavaiheeseen",
  },
  {
    keyword: "tarjouspyyntö",
    stage: "tender",
    reason: "Tarjouspyyntö viittaa tarjousvaiheeseen",
  },
  {
    keyword: "urakkalaskenta",
    stage: "tender",
    reason: "Urakkalaskenta viittaa tarjousvaiheeseen",
  },
  {
    keyword: "valittu urakoitsijaksi",
    stage: "contract_awarded",
    reason: "Urakoitsijavalinta viittaa sopimusvaiheeseen",
  },
  {
    keyword: "voitti urakan",
    stage: "contract_awarded",
    reason: "Urakan voittaminen viittaa sopimusvaiheeseen",
  },
  {
    keyword: "rakentaminen alkaa",
    stage: "construction",
    reason: "Rakentamisen aloitus viittaa rakennusvaiheeseen",
  },
  {
    keyword: "rakennustyöt käynnistyvät",
    stage: "construction",
    reason: "Rakennustöiden käynnistyminen viittaa rakennusvaiheeseen",
  },
  {
    keyword: "valmistui",
    stage: "completed",
    reason: "Valmistuminen viittaa valmistuneeseen hankkeeseen",
  },
  {
    keyword: "peruttu",
    stage: "cancelled",
    reason: "Peruttu hanke viittaa peruuntumiseen",
  },
  {
    keyword: "keskeytetty",
    stage: "cancelled",
    reason: "Keskeytetty hanke voi viitata peruuntumiseen tai pysähtymiseen",
  },
]