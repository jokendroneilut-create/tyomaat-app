import { describe, it, expect } from "vitest"
import {
  selfCompletingKind,
  isFinishedShortWork,
} from "./selfCompletingWork"

const NOW = new Date("2026-08-12T00:00:00Z")

describe("selfCompletingKind", () => {
  /* Mitatut otsikot jonosta 12.8.2026. */
  it("tunnistaa purkuhankkeen", () => {
    expect(selfCompletingKind("Lasten päiväkoti Jäkälän rakennusten purkaminen")).toBe("purku")
    expect(selfCompletingKind("Solakallion koulun purkaminen")).toBe("purku")
    expect(selfCompletingKind("Purkamislupahakemus, koulurakennuksen purkaminen")).toBe("purku")
    expect(selfCompletingKind("Kannelmäen peruskoulun purku-urakka")).toBe("purku")
  })

  /*
   * SOPIMUKSEN PURKAMINEN EI OLE PURKUTYÖ. Sama poissulku on jo
   * Dynasty-lähteessä; ilman sitä hallinnollinen sopimusriita
   * merkittäisiin valmistuneeksi rakennustyöksi.
   */
  it("ei pida sopimuksen purkamista purkutyona", () => {
    expect(
      selfCompletingKind(
        "Työllistymistä edistävän monialaisen tuen yhteistyösopimuksen purkaminen"
      )
    ).toBeNull()
    expect(selfCompletingKind("Urakkasopimuksen purkaminen")).toBeNull()
  })

  it("ei osu peruskorjaukseen tai hankesuunnitelmaan", () => {
    expect(selfCompletingKind("Finlandia-talon perusparannuksen hankesuunnitelma")).toBeNull()
    expect(selfCompletingKind("Sörnäisten metroaseman perusparannus")).toBeNull()
    expect(selfCompletingKind(null)).toBeNull()
    expect(selfCompletingKind("")).toBeNull()
  })
})

describe("isFinishedShortWork", () => {
  it("merkitsee yli kaksi vuotta vanhan purun tehdyksi", () => {
    expect(
      isFinishedShortWork({
        title: "Solakallion koulun purkaminen",
        decisionDate: "2021-05-25",
        now: NOW,
      })
    ).toBe(true)
  })

  it("ei merkitse tuoretta purkua tehdyksi", () => {
    expect(
      isFinishedShortWork({
        title: "Solakallion koulun purkaminen",
        decisionDate: "2025-06-01",
        now: NOW,
      })
    ).toBe(false)
  })

  /*
   * ISO PERUSKORJAUS SAA KESTAA. Finlandia-talon perusparannus oli
   * vuosia kesken ja koko ajan elossa - yleinen ikaraja olisi sulkenut
   * sen. Tama on koko saannon olemassaolon syy.
   */
  it("ei merkitse vanhaa peruskorjausta tehdyksi", () => {
    expect(
      isFinishedShortWork({
        title: "Finlandia-talon perusparannuksen hankesuunnitelma",
        decisionDate: "2018-06-11",
        now: NOW,
      })
    ).toBe(false)
  })

  it("ei paattele ilman paatospaivaa", () => {
    expect(
      isFinishedShortWork({
        title: "Solakallion koulun purkaminen",
        decisionDate: null,
        now: NOW,
      })
    ).toBe(false)
  })

  it("hylkaa epauskottavan paivan", () => {
    expect(
      isFinishedShortWork({
        title: "Solakallion koulun purkaminen",
        decisionDate: "1914-12-31",
        now: NOW,
      })
    ).toBe(false)
  })
})
