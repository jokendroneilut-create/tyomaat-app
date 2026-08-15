import { describe, it, expect } from "vitest"
import { projectPhaseKey } from "./projectPhaseKey"
import {
  resolveStageFit,
  roleStageWeight,
  salesMomentsForRole,
  ROLE_DATIVE_LABEL,
  ROLE_STAGE_MATRIX,
} from "./roleStageMatrix"
import { companyProfiles } from "@/app/today/components/settings/todaySettingsConfig"

describe("projectPhaseKey", () => {
  it("luottaa eksplisiittiseen kanoniseen vaiheeseen", () => {
    expect(projectPhaseKey({ phase: "Rakenteilla" })).toBe("construction")
    expect(projectPhaseKey({ phase: "Kilpailutus" })).toBe("tender")
    expect(projectPhaseKey({ phase: "Suunnittelussa" })).toBe("planning")
  })

  it("tekstifallback palauttaa edistyneimmän osuman", () => {
    // Mainitsee sekä kaavoituksen että rakennusluvan -> lupavaihe (edistyneempi)
    const p = {
      phase: null,
      metadata: { operation: "asemakaava ja rakennuslupa vireillä" },
    }
    expect(projectPhaseKey(p)).toBe("permit")
  })

  it("tunnistaa hilma-lähteen kilpailutukseksi", () => {
    expect(
      projectPhaseKey({ phase: null, metadata: { source_name: "hilma" } })
    ).toBe("tender")
  })

  it("tuntematon vaihe -> null", () => {
    expect(projectPhaseKey({ phase: null, metadata: {} })).toBeNull()
  })
})

describe("roleStageWeight", () => {
  it("arkkitehti painottaa kaavaa, materiaalitoimittaja rakentamista", () => {
    expect(roleStageWeight("Arkkitehti", "zoning")).toBe(1.0)
    expect(roleStageWeight("Arkkitehti", "construction")).toBe(0)
    expect(roleStageWeight("Rakennustuotteet", "construction")).toBe(1.0)
    expect(roleStageWeight("Rakennustuotteet", "zoning")).toBe(0)
  })

  it("rakennusliike painottaa kilpailutusta", () => {
    expect(roleStageWeight("Rakennusliike", "tender")).toBe(1.0)
  })

  it("ei roolia tai tuntematon vaihe -> 0", () => {
    expect(roleStageWeight(null, "tender")).toBe(0)
    expect(roleStageWeight("Arkkitehti", null)).toBe(0)
    expect(roleStageWeight("Muu", "tender")).toBe(0)
  })
})

/*
 * Roolivalikko ja pisteytysmatriisi ovat eri tiedostoissa, joten kirjoitusvirhe
 * tai listalle unohtunut rooli tuottaisi hiljaa painottoman käyttäjän — juuri
 * sen vian jonka D-071 korjasi. Siksi vastaavuus on testattu eikä luotettu.
 */
describe("roolivalikko vastaa matriisia", () => {
  it("jokaisella valittavalla roolilla on painot ja datiivimuoto", () => {
    for (const profile of companyProfiles) {
      expect(ROLE_STAGE_MATRIX[profile], `painot puuttuvat: ${profile}`).toBeDefined()
      expect(ROLE_DATIVE_LABEL[profile], `datiivi puuttuu: ${profile}`).toBeTruthy()
    }
  })

  it("vain 'Muu' saa olla painoton", () => {
    const weightless = companyProfiles.filter(
      (p) => Object.keys(ROLE_STAGE_MATRIX[p] ?? {}).length === 0
    )
    expect(weightless).toEqual(["Muu"])
  })
})

describe("resolveStageFit", () => {
  it("rooli voittaa käyttäjän myyntihetket", () => {
    const fit = resolveStageFit("Arkkitehti", "zoning", ["Rakenteilla"])
    expect(fit).toEqual({ weight: 1.0, source: "role" })
  })

  it("'Muu' + omat myyntihetket -> paino omasta valinnasta", () => {
    expect(resolveStageFit("Muu", "construction", ["Rakenteilla"])).toEqual({
      weight: 0.9,
      source: "moments",
    })
    expect(resolveStageFit("Muu", "zoning", ["Rakenteilla"])).toEqual({
      weight: 0,
      source: "moments",
    })
  })

  it("tunnistaa myös vaiheet joita vanha substring-logiikka ei tunnistanut", () => {
    expect(
      resolveStageFit("Muu", "contract_awarded", ["Sopimus myönnetty"]).weight
    ).toBe(0.9)
    expect(
      resolveStageFit("Muu", "nearing_completion", ["Valmistumassa"]).weight
    ).toBe(0.9)
  })

  it("ei roolia eikä myyntihetkiä -> mitattu oletus", () => {
    const fit = resolveStageFit(null, "construction", [])
    expect(fit.source).toBe("default")
    expect(fit.weight).toBeGreaterThan(0)
  })

  /*
   * P2-hälytys laukeaa vain painolla 1.0. Pääteltyä signaalia ei saa nostaa
   * sinne asti, tai lähetämme sähköpostia ihmisille jotka eivät ole kertoneet
   * meille rooliaan.
   */
  it("pääteltu paino jää alle hälytyskynnyksen", () => {
    expect(resolveStageFit("Muu", "construction", ["Rakenteilla"]).weight).toBeLessThan(1)
    expect(resolveStageFit(null, "construction", []).weight).toBeLessThan(1)
  })

  it("tuntematon vaihe -> 0", () => {
    expect(resolveStageFit("Muu", null, ["Rakenteilla"]).weight).toBe(0)
  })
})

describe("uudet roolit (D-071)", () => {
  it("aliurakoitsijan hetki on kun pääurakoitsija on valittu", () => {
    expect(roleStageWeight("Aliurakointi", "contract_awarded")).toBe(1.0)
  })

  it("henkilöstövuokraus ja konevuokraus painottavat käynnissä olevaa työmaata", () => {
    expect(roleStageWeight("Henkilöstövuokraus", "construction")).toBe(1.0)
    expect(roleStageWeight("Konevuokraus", "construction")).toBe(1.0)
  })

  it("konsultti painottaa suunnitteluvaihetta", () => {
    expect(roleStageWeight("Konsultti", "planning")).toBe(1.0)
  })
})

describe("salesMomentsForRole", () => {
  it("johtaa arkkitehdin myyntihetket varhaisista vaiheista", () => {
    expect(salesMomentsForRole("Arkkitehti")).toEqual([
      "Ideointi",
      "Kaavoitus",
      "Suunnittelu",
    ])
  })

  it("johtaa rakennusliikkeen kilpailutukseen (paino >= 0.6)", () => {
    expect(salesMomentsForRole("Rakennusliike")).toContain("Kilpailutus")
    expect(salesMomentsForRole("Rakennusliike")).not.toContain("Rakenteilla")
  })

  it("materiaalitoimittaja painottaa rakentamista", () => {
    expect(salesMomentsForRole("Rakennustuotteet")).toContain("Rakenteilla")
  })

  it("ei roolia / Muu -> tyhjä", () => {
    expect(salesMomentsForRole(null)).toEqual([])
    expect(salesMomentsForRole("Muu")).toEqual([])
  })
})
