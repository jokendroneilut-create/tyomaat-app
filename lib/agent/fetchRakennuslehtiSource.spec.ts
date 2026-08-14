import { describe, it, expect } from "vitest"
import { trimAtArticleEnd } from "./fetchRakennuslehtiSource"

describe("trimAtArticleEnd", () => {
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

    expect(trimAtArticleEnd(text)).toBe(
      "Nyab on sopinut Fingridin kanssa sähköaseman rakentamisesta Forssassa."
    )
  })

  it("katkaisee ensimmaiseen merkkiin vaikka niita on useita", () => {
    expect(trimAtArticleEnd("Teksti. Luetuimmat artikkelit X Kirjaudu sisään Y")).toBe("Teksti.")
  })

  /*
   * MAKSUTTOMASSA JUTUSSA EI OLE MAKSUMUURIA. Silloin poiminta jatkui
   * lehden omiin palkkeihin ja uutislistaan asti - mitattu tapaus
   * "Härmälänojan silta" venyi 4 000 merkkiin, ja hanta oli
   * naapuriartikkelien otsikoita.
   */
  it("katkaisee myos lehden omiin palkkeihin", () => {
    const text =
      "Härmälänojan silta avautuu syyskuun aikana. " +
      "Lue uusin lehti Tilaa uutiskirje Tuoreimmat uutiset " +
      "Rakennusteholle iso OSAO-urakka Oulussa"

    expect(trimAtArticleEnd(text)).toBe("Härmälänojan silta avautuu syyskuun aikana.")
  })

  it("palauttaa tekstin sellaisenaan jos rajaa ei ole", () => {
    expect(trimAtArticleEnd("Pelkkaa leipatekstia.")).toBe("Pelkkaa leipatekstia.")
  })
})
