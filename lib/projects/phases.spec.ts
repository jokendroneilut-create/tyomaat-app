import { describe, it, expect } from "vitest"
import {
  PHASE_LABELS,
  normalizeLegacyPhase,
  displayPhaseLabel,
} from "./phases"

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
