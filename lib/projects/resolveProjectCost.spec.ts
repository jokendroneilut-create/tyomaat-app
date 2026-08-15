import { describe, it, expect } from "vitest"
import { resolveProjectCost } from "./resolveProjectCost"

describe("resolveProjectCost", () => {
  it("sopimusarvo voittaa tekstistä poimitun arvion", () => {
    expect(
      resolveProjectCost({
        contractValue: 12_000_000,
        text: "Hankkeen kustannusarvio on 45 miljoonaa euroa.",
      })
    ).toEqual({ estimated_cost: 12_000_000, cost_source: "contract" })
  })

  it("poimii tekstistä kun sopimusarvoa ei ole", () => {
    expect(
      resolveProjectCost({ text: "Urakan arvo on 850 000 euroa." })
    ).toEqual({ estimated_cost: 850_000, cost_source: "text" })
  })

  it("ei arvoa -> null", () => {
    expect(resolveProjectCost({ text: "Urakka alkaa keväällä." })).toBeNull()
    expect(resolveProjectCost({})).toBeNull()
  })

  /*
   * Ydinsääntö: eksakti sopimusarvo ei saa korvautua arviolla, vaikka arvio
   * tulisi myöhemmästä lähdesignaalista.
   */
  it("ei ylikirjoita sopimusarvoa tekstistä poimitulla", () => {
    expect(
      resolveProjectCost({
        existingCost: 12_000_000,
        existingSource: "contract",
        text: "Hankkeen kustannusarvio on 45 miljoonaa euroa.",
      })
    ).toEqual({ estimated_cost: 12_000_000, cost_source: "contract" })
  })

  it("sopimusarvo saa korvata aiemman tekstiarvion", () => {
    expect(
      resolveProjectCost({
        existingCost: 45_000_000,
        existingSource: "text",
        contractValue: 12_000_000,
      })
    ).toEqual({ estimated_cost: 12_000_000, cost_source: "contract" })
  })

  /*
   * Ennen 15.8.2026 kirjoitetuilla riveillä ei ole alkuperämerkintää. Jos ne
   * tulkittaisiin sopimusarvoiksi, aito sopimusarvo ei koskaan kirjoittuisi
   * niiden päälle.
   */
  it("merkitsemätön vanha arvo tulkitaan arvioksi, ei sopimusarvoksi", () => {
    expect(
      resolveProjectCost({
        existingCost: 45_000_000,
        existingSource: undefined,
        contractValue: 12_000_000,
      })
    ).toEqual({ estimated_cost: 12_000_000, cost_source: "contract" })
  })

  it("säilyttää olemassa olevan arvon kun uutta ei löydy", () => {
    expect(
      resolveProjectCost({
        existingCost: 45_000_000,
        existingSource: "text",
        text: "Urakka alkaa keväällä.",
      })
    ).toEqual({ estimated_cost: 45_000_000, cost_source: "text" })
  })

  it("sivuuttaa kelvottomat arvot", () => {
    expect(resolveProjectCost({ contractValue: 0 })).toBeNull()
    expect(resolveProjectCost({ contractValue: "" })).toBeNull()
    expect(resolveProjectCost({ contractValue: "ei numero" })).toBeNull()
  })
})
