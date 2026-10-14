import { describe, expect, it } from "vitest"

import { HAKUKENTAT, hakuEhto, hakuteksti } from "./hakukentat"

describe("hakuteksti", () => {
  it("kokoaa kaikki kentat pienella", () => {
    const teksti = hakuteksti({
      name: "Koulun laajennus",
      city: "Helsinki",
      additional_info: "Kolme KERROSTA",
    })
    expect(teksti).toContain("koulun laajennus")
    expect(teksti).toContain("helsinki")
    expect(teksti).toContain("kolme kerrosta")
  })

  it("kestaa puuttuvat kentat", () => {
    expect(hakuteksti({})).toBe(HAKUKENTAT.map(() => "").join(" "))
    expect(hakuteksti({ name: null, city: undefined })).not.toContain("null")
  })
})

describe("hakuEhto", () => {
  it("hakee kaikista kentista", () => {
    const ehto = hakuEhto("koulu") ?? ""
    for (const kentta of HAKUKENTAT) {
      expect(ehto).toContain(`${kentta}.ilike."%koulu%"`)
    }
  })

  it("kattaa kuvauksen ja kaupungin — nama puuttuivat digestista", () => {
    const ehto = hakuEhto("helsinki") ?? ""
    expect(ehto).toContain('additional_info.ilike."%helsinki%"')
    expect(ehto).toContain('city.ilike."%helsinki%"')
  })

  it("osaa muutosrivien etuliitteen", () => {
    expect(hakuEhto("koulu", "after->>")).toContain('after->>city.ilike."%koulu%"')
  })

  it("lainaa hakusanan jossa on valilyonti tai pilkku", () => {
    const ehto = hakuEhto('Turun satama, laituri') ?? ""
    expect(ehto).toContain('name.ilike."%Turun satama, laituri%"')
  })

  it("palauttaa null tyhjalle", () => {
    expect(hakuEhto("")).toBeNull()
    expect(hakuEhto("   ")).toBeNull()
  })
})
