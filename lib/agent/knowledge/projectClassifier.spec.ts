import { describe, it, expect } from "vitest"
import { classifyProject } from "./projectClassifier"

describe("classifyProject – business_value", () => {
  it("päiväkotirakennus on korkea arvo", () => {
    const r = classifyProject({ title: "Päiväkoti Pellava, uudisrakennus" })
    expect(r.building_type).toBe("päiväkoti")
    expect(r.business_value).toBe("high")
  })

  it("leikkipihan perusparannus EI ole suuri hanke vaikka nimessä on päiväkoti", () => {
    const r = classifyProject({
      title: "Päiväkoti Pellava, leikkipihan perusparannus",
    })
    expect(r.business_value).toBe("medium")
    expect(r.reasons).toContain("Rajattu piha-/ulkoaluetyö – ei koko rakennus")
  })

  it("koulun pysäköintialue alenee mediumiin", () => {
    const r = classifyProject({ title: "Koulu, pysäköintialueen rakentaminen" })
    expect(r.business_value).toBe("medium")
  })

  it("pientalo on matala arvo", () => {
    const r = classifyProject({ title: "Omakotitalon rakentaminen" })
    expect(r.business_value).toBe("low")
  })
})
