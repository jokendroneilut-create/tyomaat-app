import { describe, it, expect } from "vitest"
import { trimAtPaywall } from "./fetchRakennuslehtiSource"

describe("trimAtPaywall", () => {
  /*
   * Rakennuslehti nayttaa vain artikkelin alun, ja sen jalkeen sivulla on
   * kirjautumiskehotus ja lista MUIDEN artikkelien otsikoita. Ilman
   * katkaisua ne paatyisivat hankkeen kuvaukseen - sama saaste joka
   * tuotti vaaria kohdetyyppeja ja kustannuksia muissa lahteissa.
   */
  it("katkaisee maksumuuriin", () => {
    const text =
      "Nyab on sopinut Fingridin kanssa sähköaseman rakentamisesta Forssassa. " +
      "Tämä artikkeli on tilaajille Kirjaudu sisään Luetuimmat artikkelit " +
      "Fira rakentaa ison datakeskuksen hollantilaisyhtiölle"

    expect(trimAtPaywall(text)).toBe(
      "Nyab on sopinut Fingridin kanssa sähköaseman rakentamisesta Forssassa."
    )
  })

  it("katkaisee ensimmaiseen merkkiin vaikka niita on useita", () => {
    expect(trimAtPaywall("Teksti. Luetuimmat artikkelit X Kirjaudu sisään Y")).toBe("Teksti.")
  })

  it("palauttaa tekstin sellaisenaan jos muuria ei ole", () => {
    expect(trimAtPaywall("Pelkkaa leipatekstia.")).toBe("Pelkkaa leipatekstia.")
  })
})
