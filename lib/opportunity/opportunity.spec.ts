import { describe, it, expect } from "vitest"
import { projectPhaseKey } from "./projectPhaseKey"
import { roleStageWeight, salesMomentsForRole } from "./roleStageMatrix"

describe("projectPhaseKey", () => {
  it("luottaa eksplisiittiseen kanoniseen vaiheeseen", () => {
    expect(projectPhaseKey({ phase: "Rakenteilla" })).toBe("construction")
    expect(projectPhaseKey({ phase: "Kilpailutus" })).toBe("tender")
    expect(projectPhaseKey({ phase: "Suunnittelussa" })).toBe("planning")
  })

  it("tekstifallback palauttaa edistyneimmän osuman", () => {
    // Mainitsee sekä kaavoituksen että rakennusluvan -> lupavaihe (edistyneempi)
    const p = {
      phase: null,
      metadata: { operation: "asemakaava ja rakennuslupa vireillä" },
    }
    expect(projectPhaseKey(p)).toBe("permit")
  })

  it("tunnistaa hilma-lähteen kilpailutukseksi", () => {
    expect(
      projectPhaseKey({ phase: null, metadata: { source_name: "hilma" } })
    ).toBe("tender")
  })

  it("tuntematon vaihe -> null", () => {
    expect(projectPhaseKey({ phase: null, metadata: {} })).toBeNull()
  })
})

describe("roleStageWeight", () => {
  it("arkkitehti painottaa kaavaa, materiaalitoimittaja rakentamista", () => {
    expect(roleStageWeight("Arkkitehti", "zoning")).toBe(1.0)
    expect(roleStageWeight("Arkkitehti", "construction")).toBe(0)
    expect(roleStageWeight("Rakennustuotteet", "construction")).toBe(1.0)
    expect(roleStageWeight("Rakennustuotteet", "zoning")).toBe(0)
  })

  it("rakennusliike painottaa kilpailutusta", () => {
    expect(roleStageWeight("Rakennusliike", "tender")).toBe(1.0)
  })

  it("ei roolia tai tuntematon vaihe -> 0", () => {
    expect(roleStageWeight(null, "tender")).toBe(0)
    expect(roleStageWeight("Arkkitehti", null)).toBe(0)
    expect(roleStageWeight("Muu", "tender")).toBe(0)
  })
})

describe("salesMomentsForRole", () => {
  it("johtaa arkkitehdin myyntihetket varhaisista vaiheista", () => {
    expect(salesMomentsForRole("Arkkitehti")).toEqual([
      "Ideointi",
      "Kaavoitus",
      "Suunnittelu",
    ])
  })

  it("johtaa rakennusliikkeen kilpailutukseen (paino >= 0.6)", () => {
    expect(salesMomentsForRole("Rakennusliike")).toContain("Kilpailutus")
    expect(salesMomentsForRole("Rakennusliike")).not.toContain("Rakenteilla")
  })

  it("materiaalitoimittaja painottaa rakentamista", () => {
    expect(salesMomentsForRole("Rakennustuotteet")).toContain("Rakenteilla")
  })

  it("ei roolia / Muu -> tyhjä", () => {
    expect(salesMomentsForRole(null)).toEqual([])
    expect(salesMomentsForRole("Muu")).toEqual([])
  })
})
