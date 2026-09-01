import { describe, expect, it } from "vitest"

import { evaluateAutoComplete } from "./autoCompleteGate"

const NYT = new Date("2026-09-02T00:00:00Z")

describe("evaluateAutoComplete", () => {
  it("piilottaa kun paiva on mennyt reilusti eika muuta signaalia ole", () => {
    expect(
      evaluateAutoComplete({
        estimatedCompletion: "2026-01-31",
        createdAt: "2025-06-01",
        now: NYT,
      })
    ).toBe("complete")
  })

  /* Mitattu: Hukkalansalon tuulivoimakaava, paiva 2003 mutta loydetty 2026. */
  it("ei piilota kun paiva on vanhempi kuin loytohetki", () => {
    expect(
      evaluateAutoComplete({
        estimatedCompletion: "2003-12-31",
        createdAt: "2026-07-15",
        now: NYT,
      })
    ).toBe("skip")
  })

  /* Mitattu: viisi siltaurakkaa piilotettiin 2 vrk paivan jalkeen. */
  it("odottaa kun paiva meni juuri", () => {
    expect(
      evaluateAutoComplete({
        estimatedCompletion: "2026-08-31",
        createdAt: "2026-03-05",
        now: NYT,
      })
    ).toBe("wait")
  })

  /* Lahde listaa hanketta yha - se on "muu signaali". */
  it("odottaa kun lahde on nahnyt hankkeen paivan jalkeen", () => {
    expect(
      evaluateAutoComplete({
        estimatedCompletion: "2026-01-31",
        createdAt: "2025-06-01",
        lastSeenAt: "2026-08-30T06:00:00Z",
        now: NYT,
      })
    ).toBe("wait")
  })

  it("ohittaa tyhjan paivan", () => {
    expect(evaluateAutoComplete({ estimatedCompletion: null, createdAt: "2025-01-01", now: NYT })).toBe("skip")
  })
})
