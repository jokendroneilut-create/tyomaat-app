import { describe, expect, it } from "vitest"

import { hankkeenYritysavaimet, yritysavain } from "./yritysavain"

describe("yritysavain", () => {
  it("typistaa yhtiomuodon", () => {
    expect(yritysavain("YIT Suomi Oy")).toBe("yitsuomi")
    expect(yritysavain("Lujatalo Oy")).toBe("lujatalo")
    expect(yritysavain("Kreate Group Oyj")).toBe("kreate")
  })

  it("poistaa y-tunnuksen ja valimerkit", () => {
    expect(yritysavain("Are Oy (0989493-6)")).toBe("are")
    expect(yritysavain("Pohjola Rakennus")).toBe("pohjolarakennus")
  })

  it("sama yritys eri kirjoitusasuilla antaa saman avaimen", () => {
    expect(yritysavain("NCC")).toBe(yritysavain("NCC Oy"))
    expect(yritysavain("hartela")).toBe(yritysavain("Hartela Oy"))
  })

  /*
   * ERI YKSIKKO EI OLE SAMA YRITYS. "YIT Infra" on oma
   * liiketoimintansa omine yhteyshenkiloineen, eika sita saa typistaa
   * "YIT":ksi — vaara yhteyshenkilo on pahempi kuin puuttuva.
   */
  it("ei typista liiketoiminnan nimea", () => {
    expect(yritysavain("YIT Infra")).not.toBe(yritysavain("YIT"))
  })

  it("sietaa tyhjan", () => {
    expect(yritysavain(null)).toBe("")
    expect(yritysavain("")).toBe("")
  })
})

describe("hankkeenYritysavaimet", () => {
  it("lukee seka rakennuttajan etta urakoitsijan", () => {
    expect(
      hankkeenYritysavaimet({ developer: "Hemsö", builder: "NCC Suomi Oy" }).sort()
    ).toEqual(["hemsö", "nccsuomi"])
  })

  it("purkaa listan", () => {
    const avaimet = hankkeenYritysavaimet({
      builder: "Are Oy (0989493-6), ISS Palvelut Oy (0906333-1)",
    })
    expect(avaimet).toContain("are")
    expect(avaimet).toContain("isspalvelut")
  })

  it("ohittaa liian lyhyet", () => {
    expect(hankkeenYritysavaimet({ builder: "Oy" })).toEqual([])
  })

  it("sietaa tyhjan", () => {
    expect(hankkeenYritysavaimet({})).toEqual([])
  })
})
