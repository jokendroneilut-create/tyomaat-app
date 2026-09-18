import { describe, expect, it } from "vitest"

import { hankkeenArvo, KOOSTEESSA_ENINTAAN, valitseKoosteeseen } from "./kooste"

const osuma = (id: string, rank: number) => ({ id, rank })

/*
 * KOOSTEEN YLARAJA (D-193). Kun halytys alkoi noudattaa kayttajan
 * valitsemia myyntihetkia, maara kasvoi 280 -> 928 viikossa.
 */
describe("valitseKoosteeseen", () => {
  it("nayttaa enintaan kymmenen ja kertoo loput", () => {
    const osumat = Array.from({ length: 14 }, (_, i) => osuma(`h${i}`, 0))
    const { naytettavat, muita } = valitseKoosteeseen(osumat)

    expect(naytettavat).toHaveLength(KOOSTEESSA_ENINTAAN)
    expect(muita).toBe(4)
  })

  it("ottaa suurimmat hankkeet ensin", () => {
    const osumat = [osuma("pieni", 1), osuma("suuri", 3), osuma("keski", 2)]
    expect(valitseKoosteeseen(osumat).naytettavat.map((o) => o.id)).toEqual([
      "suuri",
      "keski",
      "pieni",
    ])
  })

  it("sailyttaa saman arvon hankkeiden jarjestyksen", () => {
    const osumat = [osuma("a", 1), osuma("b", 1), osuma("c", 1)]
    expect(valitseKoosteeseen(osumat).naytettavat.map((o) => o.id)).toEqual(["a", "b", "c"])
  })

  it("ei ilmoita muita kun kaikki mahtuvat", () => {
    expect(valitseKoosteeseen([osuma("a", 1)]).muita).toBe(0)
  })
})

describe("hankkeenArvo", () => {
  it("jarjestaa suuren ensin ja sietaa puuttuvan", () => {
    expect(hankkeenArvo({ metadata: { business_value: "high" } })).toBe(3)
    expect(hankkeenArvo({ metadata: { business_value: "low" } })).toBe(1)
    expect(hankkeenArvo({ metadata: {} })).toBe(0)
    expect(hankkeenArvo(null)).toBe(0)
  })
})
