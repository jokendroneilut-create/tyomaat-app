import { describe, expect, it } from "vitest"

import { ehtiiViela, POHJA_OTOS } from "./tuontiBudjetti"

const perus = {
  nyt: 1_000_000,
  maaraaika: 1_000_000 + 30_000,
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

  /* 3 ehdokasta x 1 s = keskiarvo 1 s, varaus 1,5 s. 30 s riittaa. */
  it("aloittaa kun varaus mahtuu jaljella olevaan aikaan", () => {
    expect(ehtiiViela({ ...perus, valmiita: 3, kaytettyMs: 3_000 })).toBe(true)
  })

  /* Keskiarvo 25 s, varaus 37,5 s > 30 s jaljella. */
  it("ei aloita kun varaus ei mahdu", () => {
    expect(ehtiiViela({ ...perus, valmiita: 3, kaytettyMs: 75_000 })).toBe(false)
  })

  /*
   * Juuri tama tapaus kaatoi Hartelan: maaraaikaa on viela jaljella,
   * joten pelkka "onko maaraaika ohi" olisi aloittanut - mutta hanta
   * ylittaa katkaisun.
   */
  it("torjuu ehdokkaan jolle jaa aikaa mutta ei tarpeeksi", () => {
    const nyt = 1_000_000
    const maaraaika = nyt + 5_000
    expect(ehtiiViela({ nyt, maaraaika, valmiita: 5, kaytettyMs: 20_000 })).toBe(false)
  })

  /*
   * D-210. Vanha varaus oli keskiarvo x rinnakkaisuus (6), jolloin 12
   * sekunnin ehdokas varasi 72 s eli enemman kuin koko 70 sekunnin
   * budjetti - ajo pysahtyi tasan rinnakkaisuuden verran ehdokkaita.
   * Yhden ehdokkaan varauksella sama tilanne jatkuu normaalisti.
   */
  it("jatkaa kun yksi ehdokas mahtuu vaikka kuusi ei mahtuisi", () => {
    const nyt = 1_000_000
    /* 55 s jaljella tuontibudjettia, ehdokkaan keskiarvo 12 s. */
    const maaraaika = nyt + 55_000
    expect(ehtiiViela({ nyt, maaraaika, valmiita: 6, kaytettyMs: 72_000 })).toBe(true)
  })

  /*
   * Raja kulkee turvakertoimen mukaan: 12 s x 1,5 = 18 s varaus mahtuu
   * 20 sekuntiin muttei 17:aan.
   */
  it("noudattaa turvakerrointa rajalla", () => {
    const nyt = 1_000_000
    expect(
      ehtiiViela({ nyt, maaraaika: nyt + 20_000, valmiita: 6, kaytettyMs: 72_000 })
    ).toBe(true)
    expect(
      ehtiiViela({ nyt, maaraaika: nyt + 17_000, valmiita: 6, kaytettyMs: 72_000 })
    ).toBe(false)
  })
})
