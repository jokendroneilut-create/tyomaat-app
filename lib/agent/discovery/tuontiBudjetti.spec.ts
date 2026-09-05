import { describe, expect, it } from "vitest"

import { ehtiiViela, POHJA_OTOS } from "./tuontiBudjetti"

const perus = {
  nyt: 1_000_000,
  maaraaika: 1_000_000 + 30_000,
  rinnakkaisuus: 6,
}

describe("ehtiiViela", () => {
  /*
   * Ilman pohjaa vanha saanto: muuten ensimmainen ehdokas ei koskaan
   * lahtisi liikkeelle eika arviota syntyisi.
   */
  it("aloittaa aina kunnes pohja on mitattu", () => {
    expect(ehtiiViela({ ...perus, valmiita: 0, kaytettyMs: 0 })).toBe(true)
    expect(
      ehtiiViela({ ...perus, valmiita: POHJA_OTOS - 1, kaytettyMs: 999_999 })
    ).toBe(true)
  })

  it("ei aloita kun maaraaika on jo ohi", () => {
    expect(
      ehtiiViela({ ...perus, nyt: perus.maaraaika + 1, valmiita: 0, kaytettyMs: 0 })
    ).toBe(false)
  })

  /* 3 ehdokasta x 1 s = keskiarvo 1 s, varaus 6 s. 30 s riittaa. */
  it("aloittaa kun varaus mahtuu jaljella olevaan aikaan", () => {
    expect(ehtiiViela({ ...perus, valmiita: 3, kaytettyMs: 3_000 })).toBe(true)
  })

  /* Keskiarvo 6 s, varaus 36 s > 30 s jaljella. */
  it("ei aloita kun varaus ei mahdu", () => {
    expect(ehtiiViela({ ...perus, valmiita: 3, kaytettyMs: 18_000 })).toBe(false)
  })

  /*
   * Juuri tama tapaus kaatoi Hartelan: maaraaikaa on viela jaljella,
   * joten vanha saanto olisi aloittanut - mutta hanta ylittaa
   * katkaisun.
   */
  it("torjuu ehdokkaan jolle jaa aikaa mutta ei tarpeeksi", () => {
    const nyt = 1_000_000
    const maaraaika = nyt + 5_000
    expect(ehtiiViela({ nyt, maaraaika, valmiita: 5, kaytettyMs: 20_000, rinnakkaisuus: 6 })).toBe(
      false
    )
  })

  it("kestaa rinnakkaisuuden 0", () => {
    expect(
      ehtiiViela({ ...perus, valmiita: 3, kaytettyMs: 3_000, rinnakkaisuus: 0 })
    ).toBe(true)
  })
})
