import { describe, it, expect } from "vitest"
import { isSitowiseProjectItem } from "./fetchSitowiseSource"
import { inferDesignerPhase } from "./companyRelease"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * Otsikot ovat aitoja, poimittu Sitowisen listaussivuilta 16.8.2026.
 * Suodattimen koko tehtävä on erottaa hanke talousraportoinnista ja
 * asiantuntija-artikkeleista: 34 sijoittajauutisen otsikosta 9 oli
 * katsauksia tai uutiskirjeitä.
 */
describe("isSitowiseProjectItem", () => {
  it("hyväksyy hankeuutisen", () => {
    expect(isSitowiseProjectItem("Vantaan ratikan toisen osatilauksen sopimus solmittu")).toBe(true)
    expect(isSitowiseProjectItem("Sitowise suunnittelemaan Porin kuumasairaala-hankkeen talotekniikkaa")).toBe(true)
    expect(isSitowiseProjectItem("Itärata-hankkeen yleissuunnitelmavaiheen suunnittelijat on valittu")).toBe(true)
  })

  it("hylkää talousraportoinnin", () => {
    expect(isSitowiseProjectItem("Q2/2026 Hiljaista jaksoa edeltävä uutiskirje")).toBe(false)
    expect(isSitowiseProjectItem("Sitowisen tilinpäätöstiedote 2025 julkaistaan 11.2.2026")).toBe(false)
    expect(isSitowiseProjectItem("Osavuosikatsaus tammi-maaliskuulta 2025")).toBe(false)
  })

  it("hylkää ulkomaisen toimeksiannon", () => {
    expect(isSitowiseProjectItem("Infracontrolille 10 vuoden sopimus signaaliturvajärjestelmistä Göteborgissa")).toBe(false)
    expect(isSitowiseProjectItem("Sitowise jatkaa Ruotsin kansallisten liikennevirtojen hallintakumppanina")).toBe(false)
  })

  it("hylkää asiantuntija-artikkelin jossa ei ole kohdetta", () => {
    expect(isSitowiseProjectItem("Miksi Suomi on hyvä paikka datakeskukselle?")).toBe(false)
    expect(isSitowiseProjectItem("Energia, liikkuminen ja maankäyttö vihreässä murroksessa")).toBe(false)
  })
})

describe("inferDesignerPhase", () => {
  /*
   * TÄMÄ ON KOKO ERO URAKOITSIJAAN. Suunnittelijan "sopimus solmittu"
   * tarkoittaa suunnittelusopimusta; jos se luettaisiin urakan
   * myöntämiseksi, hanke siirtyisi vuosia todellisuutta edelle.
   */
  it("ei lue suunnittelusopimusta urakan myöntämiseksi", () => {
    expect(
      inferDesignerPhase(
        "Vantaan ratikan toisen osatilauksen sopimus solmittu",
        "Allianssiosapuolet ovat allekirjoittaneet toisen osatilauksen sopimuksen."
      )
    ).toBe(PHASE_LABELS.planning)
  })

  it("lukee rakentamisen vain kun teksti sanoo sen suoraan", () => {
    expect(
      inferDesignerPhase("Hanke etenee", "Rakentaminen on alkanut kohteessa.")
    ).toBe(PHASE_LABELS.construction)
  })

  it("lukee valmistumisen otsikosta", () => {
    expect(inferDesignerPhase("Uimahalli valmistui Ouluun", "")).toBe(
      PHASE_LABELS.completed
    )
  })
})
