import { describe, it, expect } from "vitest"
import { urakkaAjanLoppu } from "./urakkaAika"

/*
 * Jokainen tapaus on AITO katkelma kannasta (mitattu 24.10.2026),
 * myos ne joihin saanto ei saa osua.
 */
describe("urakkaAjanLoppu", () => {
  it("lukee kuukausinimin ilmaistun jakson lopun", () => {
    expect(
      urakkaAjanLoppu("Arvioitu urakka-aika on huhtikuu 2026 - joulukuu 2026.")
    ).toBe("2026-12-31")
    expect(
      urakkaAjanLoppu("Arvioitu urakka-aika on syyskuu 2026 - kesäkuu 2027 Neuvottelumenettelyyn")
    ).toBe("2027-06-30")
  })

  it("lukee jakson myös välisanojen takaa", () => {
    expect(
      urakkaAjanLoppu("Arvioitu urakka-aika maanrakennustöille on huhtikuu 2027 - heinäkuu 2027.")
    ).toBe("2027-07-31")
  })

  it("lukee kuukausi/vuosi-muodon välilyönteineen", () => {
    expect(urakkaAjanLoppu("Urakka-aika 03/2026 – 05/2027.")).toBe("2027-05-31")
    expect(urakkaAjanLoppu("Hankkeen toteutusaikataulu 05 / 2026 - 01 / 2027.")).toBe("2027-01-31")
  })

  it("lukee täsmälliset päivämäärät", () => {
    expect(urakkaAjanLoppu("Alustava urakka-aika 21.7.2026 - 24.9.2027,")).toBe("2027-09-24")
  })

  it("ottaa myöhäisimmän kun jaksoja on kaksi", () => {
    expect(
      urakkaAjanLoppu("Urakka-aika on 5.10. – 31.12.2026 ja 3.5. – 11.6.2027. Sakollinen välitavoite")
    ).toBe("2027-06-11")
  })

  it("lukee sijamuodoin ilmaistun jakson", () => {
    expect(
      urakkaAjanLoppu("Urakka 3:n toteutusaika on maaliskuusta 2024 elokuuhun 2027.")
    ).toBe("2027-08-31")
  })

  describe("ei saa osua", () => {
    it("johdokseen", () => {
      expect(urakkaAjanLoppu("Hankkeen rakennusaikaiset muutostyöt 1.1.2026 - 1.6.2026")).toBeNull()
      expect(urakkaAjanLoppu("Rakennusaikainen tärinä VE1a 2026 - 2027")).toBeNull()
      expect(
        urakkaAjanLoppu("Työmaan arjessa jo rakennusaikana, 1/2026 - 5/2027 näkyvä ratkaisu")
      ).toBeNull()
    })

    it("sopimusaikaan", () => {
      /* Vuokrakausi ei ole urakka-aika. */
      expect(urakkaAjanLoppu("Sopimusaika on 1.1.2026 - 31.12.2035.")).toBeNull()
      expect(urakkaAjanLoppu("niissä sopimusaikana toteutettavia 1/2026 - 5/2027")).toBeNull()
    })

    it("jaksoon ilman päivämäärää", () => {
      expect(
        urakkaAjanLoppu("urakka-aika alkaa ja urakkasopimus tulee voimaan, kun sopimus on allekirjoitettu")
      ).toBeNull()
      expect(urakkaAjanLoppu("Urakka-aika on esitetty urakkasopimusluonnoksessa.")).toBeNull()
      expect(urakkaAjanLoppu("Tarkempi toteutusaikataulu sovitaan sopimusneuvotteluissa.")).toBeNull()
    })

    it("aikataululistan myöhempään riviin", () => {
      /*
       * Listassa ensimmäinen väli on 70 merkin päässä avainsanasta, ja
       * se on suunnitteluvaihe -- ei urakan valmistuminen.
       */
      expect(
        urakkaAjanLoppu(
          "Rakennuksen toteutusaikataulu on seuraava: hankesuunnitelman hyväksyminen 6/2026 toteutussuunnittelu 8/2026–2/2027 urakkalaskenta"
        )
      ).toBeNull()
    })

    it("luetelmaviivalliseen aikataululistaan", () => {
      /* Aito katkelma Helsingin paatostekstista: viivat ovat luetelmamerkkeja. */
      expect(
        urakkaAjanLoppu(
          "Hankkeen alustava suunnittelu- ja toteutusaikataulu on seuraava:- suunnittelu 2020- rakentaminen/käyttöönotto 9/2020 - 12/2020- muutto kotihoidon lääkärit"
        )
      ).toBeNull()
      expect(
        urakkaAjanLoppu(
          "Hankkeen suunnittelu- ja toteutusaikataulu on seuraava: - hankesuunnittelu ja toteutussuunnittelu 01/2020 - 12/2020 - rakentaminen 01/2021 - 04/2021."
        )
      ).toBeNull()
    })

    it("tyhjään tekstiin", () => {
      expect(urakkaAjanLoppu(null)).toBeNull()
      expect(urakkaAjanLoppu("")).toBeNull()
      expect(urakkaAjanLoppu("Kohde valmistuu vuonna 2027.")).toBeNull()
    })
  })
})
