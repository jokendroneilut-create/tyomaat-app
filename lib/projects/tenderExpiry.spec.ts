import { describe, it, expect } from "vitest"
import { isTenderEnriched, resolveExpiry, shouldUnexpire } from "./tenderExpiry"
import { PHASE_LABELS } from "./phases"

describe("shouldUnexpire", () => {
  /*
   * Ydintapaus: kilpailutus vanheni vuosi määräajasta, ja voittaja selvisi
   * vasta sen jälkeen. Ilman palautusta hanke rikastuisi oikein mutta pysyisi
   * piilossa kartalta, /today-näkymästä ja tiimilistalta.
   */
  it("palauttaa vanhentuneen hankkeen kun voittaja selviää", () => {
    expect(shouldUnexpire("expired", { winners: ["Lujatalo Oy"] })).toBe(true)
    expect(shouldUnexpire("expired", { is_contract_award: true })).toBe(true)
  })

  it("ei koske aktiiviseen hankkeeseen", () => {
    expect(shouldUnexpire("active", { winners: ["Lujatalo Oy"] })).toBe(false)
  })

  it("ei palauta vanhentunutta ilman voittajaa", () => {
    expect(shouldUnexpire("expired", { winners: [] })).toBe(false)
    expect(shouldUnexpire("expired", { is_contract_award: false })).toBe(false)
    expect(shouldUnexpire("expired", {})).toBe(false)
    expect(shouldUnexpire("expired", null)).toBe(false)
  })

  /*
   * Valmistunut hanke on eri asia kuin vanhentunut kilpailutus - sitä ei
   * herätetä takaisin aktiiviseksi.
   */
  it("ei palauta valmistunutta hanketta", () => {
    expect(shouldUnexpire("completed", { winners: ["Lujatalo Oy"] })).toBe(false)
  })
})

describe("isTenderEnriched", () => {
  it("tunnistaa voittajan molemmista merkinnöistä", () => {
    expect(isTenderEnriched({ is_contract_award: true })).toBe(true)
    expect(isTenderEnriched({ winners: ["YIT"] })).toBe(true)
    expect(isTenderEnriched({ winners: [] })).toBe(false)
    expect(isTenderEnriched(null)).toBe(false)
  })
})

describe("resolveExpiry", () => {
  it("laskee vanhenemisen tarjousten määräajasta", () => {
    const exp = resolveExpiry(
      { deadline: "2026-08-17T12:00:00+00:00" },
      PHASE_LABELS.tender
    )
    expect(exp?.date.getUTCFullYear()).toBe(2027)
    expect(exp?.manual).toBe(false)
  })

  /*
   * Rikastunut hanke ei vanhene enää koskaan - tämä on syy siihen ettei
   * palautettua hanketta tarvitse erikseen suojata cronilta.
   */
  it("ei vanhene enää kun voittaja on selvinnyt", () => {
    expect(
      resolveExpiry(
        { deadline: "2020-01-01T00:00:00+00:00", winners: ["YIT"] },
        PHASE_LABELS.tender
      )
    ).toBeNull()
  })

  it("ei vanhene muissa vaiheissa ilman manuaalista päivää", () => {
    expect(
      resolveExpiry({ deadline: "2026-08-17T12:00:00+00:00" }, PHASE_LABELS.zoning)
    ).toBeNull()
  })

  it("manuaalinen expire_at pätee missä tahansa vaiheessa", () => {
    const exp = resolveExpiry(
      { expire_at: "2027-01-01T00:00:00.000Z" },
      PHASE_LABELS.zoning
    )
    expect(exp?.manual).toBe(true)
  })
})
