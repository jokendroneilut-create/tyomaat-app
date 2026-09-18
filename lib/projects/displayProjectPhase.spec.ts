import { describe, expect, it } from "vitest"

import { displayProjectPhase } from "./phases"

describe("displayProjectPhase (D-196)", () => {
  it("merkitsee keskeytetyn kilpailutuksen", () => {
    expect(displayProjectPhase("Kilpailutus", true)).toBe("Kilpailutus (keskeytetty)")
    expect(displayProjectPhase("tender", true)).toBe("Kilpailutus (keskeytetty)")
  })

  it("ei merkitse ilman lippua tai muussa vaiheessa", () => {
    expect(displayProjectPhase("Kilpailutus", false)).toBe("Kilpailutus")
    expect(displayProjectPhase("Kilpailutus", null)).toBe("Kilpailutus")
    expect(displayProjectPhase("Sopimus myönnetty", true)).toBe("Sopimus myönnetty")
  })
})
