import { describe, expect, it } from "vitest"
import { hankkeenTyyppi } from "./hankkeenTyyppi"

describe("hankkeenTyyppi", () => {
  it("lukee property_type-sarakkeen", () => {
    expect(hankkeenTyyppi({ property_type: "Datakeskus" })).toBe("Datakeskus")
  })

  it("yhtenäistää alkukirjaimen", () => {
    /* Kannassa on 177 kertaa "Koulu" ja 12 kertaa "koulu". */
    expect(hankkeenTyyppi({ property_type: "koulu" })).toBe("Koulu")
  })

  it("ei koske numerolla alkavaan arvoon", () => {
    expect(
      hankkeenTyyppi({ property_type: "2x110 ja 110 kilovoltin voimajohtojärjestelyt" })
    ).toBe("2x110 ja 110 kilovoltin…")
  })

  it("katkaisee pitkän sanan rajalta", () => {
    const pitka =
      "Metallimalmien ja muiden kaivoskivennäisten louhinta, rikastaminen ja käsittely"
    const tulos = hankkeenTyyppi({ property_type: pitka })!

    expect(tulos.endsWith("…")).toBe(true)
    expect(tulos.length).toBeLessThanOrEqual(35)
    expect(tulos).toBe("Metallimalmien ja muiden…")
  })

  it("ei jätä pilkkua kolmen pisteen eteen", () => {
    expect(
      hankkeenTyyppi({ property_type: "Teollisuus, logistiikka, varasto, ja muuta pitkää" })
    ).toBe("Teollisuus, logistiikka, varasto…")
  })

  it("jättää rajalle mahtuvan arvon koskematta", () => {
    /* 45 merkkiä ei mahdu, mutta 33 mahtuu sellaisenaan. */
    expect(hankkeenTyyppi({ property_type: "Energian ja aineiden siirto, sekä" })).toBe(
      "Energian ja aineiden siirto, sekä"
    )
  })

  it("putoaa construction_typeen kun sarake on tyhjä", () => {
    expect(
      hankkeenTyyppi({
        property_type: null,
        metadata: { construction_type: "Uudisrakentaminen" },
      })
    ).toBe("Uudisrakentaminen")
  })

  it("suosii property_typeä metadatan yli", () => {
    expect(
      hankkeenTyyppi({
        property_type: "Datakeskus",
        metadata: { building_type: "Toimitila", construction_type: "Uudisrakentaminen" },
      })
    ).toBe("Datakeskus")
  })

  it("palauttaa nullin kun tyyppiä ei tiedetä", () => {
    expect(hankkeenTyyppi({ property_type: "   ", metadata: {} })).toBeNull()
    expect(hankkeenTyyppi({})).toBeNull()
    expect(hankkeenTyyppi(null)).toBeNull()
  })

  it("siivoaa rivinvaihdot ja tuplavälit", () => {
    expect(hankkeenTyyppi({ property_type: " Liike-  ja\ntoimitila " })).toBe(
      "Liike- ja toimitila"
    )
  })
})
