import { describe, it, expect } from "vitest"
import { extractYvaDeveloper, cleanYvaContent } from "./fetchYvaSource"

describe("extractYvaDeveloper", () => {
  /*
   * `organization` on YVA-aineistossa viranomainen (ELY / Lupa- ja
   * valvontavirasto), ei rakennuttaja. Rakennuttaja lukee leipätekstissä, ja
   * mitatussa 25 hankkeen otoksessa kuvio "X suunnittelee" esiintyi 22:ssa.
   */
  it("poimii hankkeesta vastaavan suunnittelee-kuviosta", () => {
    expect(
      extractYvaDeveloper(
        "Infinergies Finland Oy suunnittelee enintään 68 tuulivoimalan " +
          "suuruisen tuulivoima-alueen rakentamista Kärsämäen Halmemäen alueelle."
      )
    ).toBe("Infinergies Finland Oy")
  })

  it("poimii hankkeesta vastaava -kuviosta", () => {
    expect(
      extractYvaDeveloper(
        "Hankkeesta vastaavana toimiva Eolus Energy Oy suunnittelee " +
          "Myllykankaan tuulivoimapuistoa Sonkajärven kuntaan."
      )
    ).toBe("Eolus Energy Oy")
  })

  /*
   * Sivun lyhytosoite on leipätekstin seassa ja päättyy usein isoihin
   * kirjaimiin, jolloin se liittyi heti perässä olevaan nimeen. Mitattu:
   * "...rikastushiekka-YVA Dragon Mining Oy suunnittelee" tuotti nimen
   * "YVA Dragon Mining Oy".
   */
  it("ei kaappaa sivun osoitetta nimeen", () => {
    expect(
      extractYvaDeveloper(
        "Tämän sivun lyhytosoite on www.ymparisto.fi/vammalan-rikastamo-" +
          "rikastushiekka-YVA Dragon Mining Oy suunnittelee Vammalan rikastamon " +
          "rikastushiekka-alueen laajentamista."
      )
    ).toBe("Dragon Mining Oy")
  })

  /*
   * Pienellä alkava nimi ("wpd Suomi Oy") ei mahdu NAME-kuvioon, jolloin
   * kaappaus alkoi keskeltä ja tuotti nimen "Suomi Oy". Mieluummin tyhjä kuin
   * väärä rakennuttaja.
   */
  it("hylkää katkenneen nimen ennemmin kuin arvaa", () => {
    expect(
      extractYvaDeveloper("Hankkeen kuvaus wpd Suomi Oy suunnittelee tuulipuistoa Kainuuseen.")
    ).toBeNull()
  })

  /*
   * Yhtiömuotoa vaaditaan, koska kuvio on löyhä: ilman sitä yleissana
   * poimittaisiin nimeksi.
   */
  it("ei poimi yleissanaa nimeksi", () => {
    expect(
      extractYvaDeveloper("Yhtiö suunnittelee alueelle uutta tuotantolaitosta.")
    ).toBeNull()
  })

  it("sietää tyhjän", () => {
    expect(extractYvaDeveloper(null)).toBeNull()
  })
})

describe("cleanYvaContent", () => {
  it("siivoaa entiteetit ja pudottaa toistuvan otsikon", () => {
    expect(
      cleanYvaContent(
        "Halmemäen tuulivoimahanke, Kärsämäki Hankkeen kuvaus&nbsp;Infinergies " +
          "Finland   Oy suunnittelee.",
        "Halmemäen tuulivoimahanke, Kärsämäki"
      )
    ).toBe("Hankkeen kuvaus Infinergies Finland Oy suunnittelee.")
  })

  it("sietää tyhjän", () => {
    expect(cleanYvaContent(null, "Otsikko")).toBeNull()
  })
})
