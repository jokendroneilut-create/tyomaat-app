import { describe, expect, it } from "vitest"
import {
  candidateProcedure,
  haveDifferentProcedures,
  procedureFromUrl,
  projectProcedures,
} from "./hilmaProcedure"

const ILMOITUS = (procedure: string, enotice: string) =>
  `https://www.hankintailmoitukset.fi/fi/public/procedure/${procedure}/enotice/${enotice}/`

describe("procedureFromUrl", () => {
  it("lukee numeron ilmoitusosoitteesta", () => {
    expect(procedureFromUrl(ILMOITUS("35852", "54692"))).toBe("35852")
  })

  it("ei sekoita enotice-numeroa procedureen", () => {
    expect(procedureFromUrl(ILMOITUS("36768", "61903"))).toBe("36768")
  })

  it("muu osoite ei anna numeroa", () => {
    expect(procedureFromUrl("https://tarjouspalvelu.fi/edusampo?id=626467")).toBeNull()
    expect(procedureFromUrl(null)).toBeNull()
  })
})

describe("projectProcedures", () => {
  it("kerää numerot kentästä, osoitteesta ja lähdehistoriasta", () => {
    const hanke = {
      metadata: {
        procedure_id: "35852",
        source_url: ILMOITUS("35852", "54692"),
        source_history: [
          { document_url: ILMOITUS("35852", "59837") },
          { document_url: ILMOITUS("36768", "61903") },
          { document_url: "https://tarjouspalvelu.fi/edusampo?id=1" },
        ],
      },
    }

    expect([...projectProcedures(hanke)].sort()).toEqual(["35852", "36768"])
  })

  it("tyhjä metadata ei kaadu", () => {
    expect(projectProcedures({}).size).toBe(0)
    expect(projectProcedures({ metadata: null }).size).toBe(0)
  })
})

describe("candidateProcedure", () => {
  it("kelpuuttaa pelkän numeron", () => {
    expect(candidateProcedure({ procedureId: "36768" })).toBe("36768")
  })

  it("lukee osoitteesta kun kenttää ei ole", () => {
    expect(candidateProcedure({ sourceUrl: ILMOITUS("36768", "61903") })).toBe("36768")
  })

  it("ei arvaa muusta tekstistä", () => {
    expect(candidateProcedure({ procedureId: "HEL-2026-015559" })).toBeNull()
  })
})

describe("haveDifferentProcedures", () => {
  const hanke = {
    metadata: {
      procedure_id: "35852",
      source_history: [{ document_url: ILMOITUS("35852", "59837") }],
    },
  }

  it("sama hankinta: ei estoa (hankinta- ja jälki-ilmoitus)", () => {
    expect(haveDifferentProcedures(hanke, { sourceUrl: ILMOITUS("35852", "54692") })).toBe(false)
  })

  it("ERI hankinta: esto", () => {
    /* Piikatu 6: maanrakennusurakka 35852 vs. jaettu urakka 36768. */
    expect(haveDifferentProcedures(hanke, { sourceUrl: ILMOITUS("36768", "61903") })).toBe(true)
  })

  it("tuntematon ei ole eri: ehdokkaalta puuttuu numero", () => {
    expect(haveDifferentProcedures(hanke, { sourceUrl: "https://www.sttinfo.fi/tiedote/1" })).toBe(false)
  })

  it("tuntematon ei ole eri: hankkeelta puuttuu numero", () => {
    expect(haveDifferentProcedures({ metadata: {} }, { sourceUrl: ILMOITUS("36768", "61903") })).toBe(false)
  })

  it("hanke joka on jo kerännyt monta hankintaa hyväksyy omansa", () => {
    const kasautunut = {
      metadata: {
        source_history: [
          { document_url: ILMOITUS("29688", "1") },
          { document_url: ILMOITUS("30280", "2") },
        ],
      },
    }

    expect(haveDifferentProcedures(kasautunut, { sourceUrl: ILMOITUS("30280", "3") })).toBe(false)
    expect(haveDifferentProcedures(kasautunut, { sourceUrl: ILMOITUS("99999", "4") })).toBe(true)
  })
})
