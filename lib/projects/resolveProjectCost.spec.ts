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

  /*
   * Ihmisen korjaus ei saa kumoutua seuraavalla poiminnalla — muuten
   * muokkausreitti (D-076) olisi hyödytön, koska agentti ylikirjoittaisi
   * korjauksen heti.
   */
  it("käsin syötetty voittaa sekä sopimusarvon että tekstin", () => {
    expect(
      resolveProjectCost({
        existingCost: 82_400_000,
        existingSource: "manual",
        contractValue: 12_000_000,
        text: "Hankkeen kustannusarvio on 45 miljoonaa euroa.",
      })
    ).toEqual({ estimated_cost: 82_400_000, cost_source: "manual" })
  })

  /*
   * ILMOITUKSEN ENNAKOITU ARVO (D-291). Hameenkyron ikkunaremontissa
   * ilmoituksessa luki 250 000 EUR eika kannassa ollut mitaan, koska
   * poiminta luki vain ratkaisun summia.
   */
  it("lukee ilmoituksen ennakoidun arvon", () => {
    expect(resolveProjectCost({ noticeValue: 250_000 })).toEqual({
      estimated_cost: 250_000,
      cost_source: "notice",
    })
  })

  it("ilmoituksen arvio voittaa tekstista poimitun", () => {
    /* Rakenteinen kentta on luotettavampi kuin tekstista arvattu. */
    expect(
      resolveProjectCost({
        noticeValue: 250_000,
        text: "Hankkeen kustannusarvio on 45 miljoonaa euroa.",
      })
    ).toEqual({ estimated_cost: 250_000, cost_source: "notice" })
  })

  it("sopimusarvo voittaa ilmoituksen arvion", () => {
    /* Toteutunut hinta on tarkempi kuin kilpailutusvaiheen arvio. */
    expect(
      resolveProjectCost({
        contractValue: 312_000,
        noticeValue: 250_000,
      })
    ).toEqual({ estimated_cost: 312_000, cost_source: "contract" })
  })

  it("kasin syotetty voittaa myos ilmoituksen arvion", () => {
    expect(
      resolveProjectCost({
        existingCost: 400_000,
        existingSource: "manual",
        noticeValue: 250_000,
      })
    ).toEqual({ estimated_cost: 400_000, cost_source: "manual" })
  })

  it("ilmoituksen arvio ei ylikirjoita aiempaa sopimusarvoa", () => {
    expect(
      resolveProjectCost({
        existingCost: 312_000,
        existingSource: "contract",
        noticeValue: 250_000,
      })
    ).toEqual({ estimated_cost: 312_000, cost_source: "contract" })
  })

  it("sivuuttaa kelvottomat arvot", () => {
    expect(resolveProjectCost({ contractValue: 0 })).toBeNull()
    expect(resolveProjectCost({ contractValue: "" })).toBeNull()
    expect(resolveProjectCost({ contractValue: "ei numero" })).toBeNull()
    expect(resolveProjectCost({ noticeValue: 0 })).toBeNull()
    expect(resolveProjectCost({ noticeValue: -5 })).toBeNull()
  })
})
