import { describe, expect, it } from "vitest"

import { yhteystiedotVapaastaTekstista } from "./vapaaYhteystieto"

/*
 * Muodot Tuusulan kaava-aineistosta (D-198); nimet ja numerot keksittyjä.
 */
describe("yhteystiedotVapaastaTekstista", () => {
  it("erottaa nimen, puhelimen ja sähköpostin rivitetystä tekstistä", () => {
    const [c] = yhteystiedotVapaastaTekstista("Maija Meikäläinen\nKaavasuunnittelija\n040 123 4567\nmaija.meikalainen@tuusula.fi")
    expect(c.name).toBe("Maija Meikäläinen")
    expect(c.phone).toBeTruthy()
    expect(c.email).toBe("maija.meikalainen@tuusula.fi")
  })

  it("lukee lausemuodon", () => {
    const [c] = yhteystiedotVapaastaTekstista("Lisätietoja asiasta antaa kaavasuunnittelija Maija Meikäläinen p. 040 123 4567")
    expect(c.name).toBe("Maija Meikäläinen")
    expect(c.phone).toBeTruthy()
  })

  it("purkaa HTML-entiteetit ennen poimintaa", () => {
    const c = yhteystiedotVapaastaTekstista("Kaavasuunnittelija Maija Meikäläinen, 040 123 4567 &#x2F; maija.meikalainen@tuusula.fi")
    expect(c[0].email).toBe("maija.meikalainen@tuusula.fi")
  })

  it("ei jätä kentän lyhennettä tittelliksi", () => {
    const [c] = yhteystiedotVapaastaTekstista("asemakaava-arkkitehti Matti Meikäläinen\nsp. matti.meikalainen@tuusula.fi\np. 040 123 4567")
    expect(c.title).not.toBe("sp.")
  })

  it("säilyttää pelkän nimen ja hylkää tyhjän", () => {
    expect(yhteystiedotVapaastaTekstista("kaavasuunnittelija Maija Meikäläinen")).toEqual([
      { name: "kaavasuunnittelija Maija Meikäläinen", title: null, phone: null, email: null },
    ])
    expect(yhteystiedotVapaastaTekstista("  ")).toEqual([])
    expect(yhteystiedotVapaastaTekstista(null)).toEqual([])
  })
})
