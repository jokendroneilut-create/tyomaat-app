import { describe, it, expect } from "vitest"
import {
  PHASE_LABELS,
  normalizeLegacyPhase,
  displayPhaseLabel,
  phaseAdvances,
  phaseOrder,
} from "./phases"

describe("phaseAdvances", () => {
  it("sallii etenemisen", () => {
    expect(phaseAdvances("Suunnittelussa", "Rakenteilla")).toBe(true)
    expect(phaseAdvances("Kaavoitus", "Kilpailutus")).toBe(true)
    expect(phaseAdvances("Kilpailutus", "Sopimus myönnetty")).toBe(true)
  })

  /*
   * Mitattu tuotannosta: 4 vrk:n ikkunassa 29 hanketta siirtyi
   * Rakenteilla -> Suunnittelussa agentin tuonnista, mm. hanke jonka vaihe
   * oli asetettu käsin hyväksynnässä.
   */
  it("estää peruuttamisen", () => {
    expect(phaseAdvances("Rakenteilla", "Suunnittelussa")).toBe(false)
    expect(phaseAdvances("Valmistunut", "Rakenteilla")).toBe(false)
    expect(phaseAdvances("Rakenteilla", "Rakenteilla")).toBe(false)
  })

  it("hyväksyy minkä tahansa vaiheen kun nykyistä ei ole", () => {
    expect(phaseAdvances(null, "Suunnittelussa")).toBe(true)
    expect(phaseAdvances("jotain tuntematonta", "Rakenteilla")).toBe(true)
  })

  it("ei ylikirjoita tuntemattomalla tai järjestyksettömällä vaiheella", () => {
    expect(phaseAdvances("Rakenteilla", null)).toBe(false)
    expect(phaseAdvances("Rakenteilla", "Peruttu")).toBe(false)
    expect(phaseAdvances("Suunnittelussa", "Höpöhöpö")).toBe(false)
  })

  it("ymmärtää vanhat kirjoitusasut molemmin puolin", () => {
    expect(phaseAdvances("suunnittelussa", "Rakenteilla")).toBe(true)
    expect(phaseAdvances("rakentaminen aloitettu", "Suunnittelussa")).toBe(false)
  })

  /*
   * project_phase_history tallentaa avaimia ja projects.phase otsikoita, joten
   * vertailu voi saada kumpaa tahansa muotoa.
   */
  it("toimii myös kanonisilla avaimilla", () => {
    expect(phaseAdvances("construction", "planning")).toBe(false)
    expect(phaseAdvances("planning", "construction")).toBe(true)
    expect(phaseAdvances("construction", "Suunnittelussa")).toBe(false)
  })
})

describe("phaseOrder", () => {
  it("antaa kanonisen järjestyksen ja null tuntemattomalle", () => {
    expect(phaseOrder("Suunnittelussa")).toBe(3)
    expect(phaseOrder("Rakenteilla")).toBe(7)
    expect(phaseOrder("Peruttu")).toBeNull()
    expect(phaseOrder(null)).toBeNull()
  })
})

describe("normalizeLegacyPhase", () => {
  it("tunnistaa kanonisen labelin suoraan", () => {
    expect(normalizeLegacyPhase("Kilpailutus")).toBe("tender")
    expect(normalizeLegacyPhase("Sopimus myönnetty")).toBe("contract_awarded")
    expect(normalizeLegacyPhase("Valmistunut")).toBe("completed")
  })

  it("mappaa vanhat pienaakkoset legacy-taulukon kautta", () => {
    expect(normalizeLegacyPhase("kilpailutus")).toBe("tender")
    expect(normalizeLegacyPhase("sopimus myönnetty")).toBe("contract_awarded")
    expect(normalizeLegacyPhase("rakentaminen aloitettu")).toBe("construction")
  })

  it("siistii välilyönnit ennen vertailua", () => {
    expect(normalizeLegacyPhase("  Kilpailutus  ")).toBe("tender")
  })

  it("palauttaa null tyhjälle tai tuntemattomalle", () => {
    expect(normalizeLegacyPhase(null)).toBeNull()
    expect(normalizeLegacyPhase(undefined)).toBeNull()
    expect(normalizeLegacyPhase("")).toBeNull()
    expect(normalizeLegacyPhase("jotain tuntematonta")).toBeNull()
  })
})

describe("displayPhaseLabel", () => {
  it("näyttää kanonisen labelin legacy-arvolle", () => {
    expect(displayPhaseLabel("kilpailutus")).toBe("Kilpailutus")
    expect(displayPhaseLabel("Sopimus myönnetty")).toBe("Sopimus myönnetty")
  })

  it("palauttaa alkuperäisen (trimmattuna) tuntemattomalle", () => {
    expect(displayPhaseLabel("  Oma vaihe  ")).toBe("Oma vaihe")
  })

  it("palauttaa viivan tyhjälle", () => {
    expect(displayPhaseLabel(null)).toBe("-")
    expect(displayPhaseLabel("")).toBe("-")
  })
})

describe("PHASE_LABELS", () => {
  it("sisältää kilpailutus- ja sopimusvaiheet oikeilla labeleilla", () => {
    expect(PHASE_LABELS.tender).toBe("Kilpailutus")
    expect(PHASE_LABELS.contract_awarded).toBe("Sopimus myönnetty")
    expect(PHASE_LABELS.completed).toBe("Valmistunut")
  })
})
