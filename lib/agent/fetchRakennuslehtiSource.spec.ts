import { describe, it, expect } from "vitest"
import { arvioiJuttu, trimAtArticleEnd } from "./fetchRakennuslehtiSource"

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

/*
 * Syotteen lapikaynti 17.10.2026 (`scripts/tarkista-rakennuslehti-syote.ts`)
 * loysi 50 jutusta kolme aitoa hanketta jotka suodatin pudotti. Nama
 * testit lukitsevat sen MITA arvio kertoo, jotta syy nakyy eika vain
 * tulos: "ei_signaalia" on eri vika kuin "poissulku".
 */
describe("arvioiJuttu", () => {
  it("kelpuuttaa hankesignaalin", () => {
    const a = arvioiJuttu("Nyab rakentaa sahkoaseman Forssaan", "Rakentaminen alkaa elokuussa.")
    expect(a.kelpaa).toBe(true)
  })

  it("merkitsee valmistuneen", () => {
    const a = arvioiJuttu("Kampin uusi sisaankaynti valmistui", "Hanke rakennetaan valmiiksi.")
    expect(a).toEqual({ kelpaa: true, valmistunut: true })
  })

  it("kertoo kun hankesignaali puuttuu", () => {
    const a = arvioiJuttu("Helsinkiin nousee uusi liikuntahalli", "Vesikatto toteutetaan kotelolaatoilla.")
    expect(a).toEqual({ kelpaa: false, syy: "ei_signaalia" })
  })

  it("kertoo poissulkevan sanan nimelta", () => {
    const a = arvioiJuttu("Talotekniikkakonserni osti kolme yritysta", "Konserni rakentaa kasvua yritysostoilla.")
    expect(a.kelpaa).toBe(false)
    if (!a.kelpaa && a.syy === "poissulku") {
      expect(a.sana).toBe("yritysost")
    } else {
      throw new Error("odotettiin poissulkua")
    }
  })

  /*
   * Poissulku voittaa signaalin, ja se on tarkoitus: "palkittiin" kertoo
   * jutun olevan tunnustus eika hanke, vaikka otsikossa olisi urakka.
   */
  it("poissulku voittaa hankesignaalin", () => {
    const a = arvioiJuttu("Oulun jalkapallostadion pokkasi palkinnon", "Stadion rakennettiin kahdessa vuodessa.")
    expect(a.kelpaa).toBe(false)
  })
})
