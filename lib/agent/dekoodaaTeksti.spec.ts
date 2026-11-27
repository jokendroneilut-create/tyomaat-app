import { describe, expect, it } from "vitest"
import { dekoodaaTeksti } from "./dekoodaaTeksti"

describe("dekoodaaTeksti (D-458)", () => {
  it("lukee UTF-8:n oikein", () => {
    expect(dekoodaaTeksti(new TextEncoder().encode("Kirkonkylän asemakaavan muutos, Poikkijoen ranta"))).toBe(
      "Kirkonkylän asemakaavan muutos, Poikkijoen ranta"
    )
  })

  it("lukee ISO-8859-1:n oikein", () => {
    const latin1 = Uint8Array.from([0x4b, 0x69, 0x72, 0x6b, 0x6f, 0x6e, 0x6b, 0x79, 0x6c, 0xe4, 0x6e])
    expect(dekoodaaTeksti(latin1)).toBe("Kirkonkylän")
  })
})
