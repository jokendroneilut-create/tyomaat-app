import { describe, it, expect } from "vitest"
import {
  teeKuviot,
  etsiTunnetutYritykset,
  kelpaaListalle,
  yritysRunko,
  erotteleNimet,
} from "./tunnetutYritykset"

/* Nimet ja tekstit ovat aitoja (mitattu 24.10.2026). */
const LISTA = teeKuviot([
  "VAV Yhtymä Oy",
  "VAV Asunnot Oy",
  "Toivo Group Oyj",
  "Lujatalo Oy",
  "Pohjola Rakennus Oy Suomi",
  "Kiinteistö Oy",
  "Vesi Oy",
  "SRV Yhtiöt Oyj",
])

describe("lista", () => {
  it("hylkää katkenneen nimen", () => {
    expect(kelpaaListalle("Kiinteistö Oy")).toBe(false)
    expect(kelpaaListalle("Vesi Oy")).toBe(false)
    expect(kelpaaListalle("Suomi Oy")).toBe(false)
  })

  it("hyväksyy aidon nimen", () => {
    expect(kelpaaListalle("VAV Yhtymä Oy")).toBe(true)
    expect(kelpaaListalle("Lujatalo Oy")).toBe(true)
  })

  it("hylkää verkkoyhtiön", () => {
    /* Katusuunnitelman vakioluettelo: 635 / 2 378 lisäystä ilman tätä. */
    expect(kelpaaListalle("Helen Oy")).toBe(false)
    expect(kelpaaListalle("Telia Finland Oyj")).toBe(false)
    expect(kelpaaListalle("DNA Oyj")).toBe(false)
    expect(kelpaaListalle("Caruna Oy")).toBe(false)
    /* Muut energiayhtiöt kelpaavat: rajaus on lueteltu, ei pääteltu. */
    expect(kelpaaListalle("Vantaan Energia Oy")).toBe(true)
    expect(kelpaaListalle("EPV Energia Oy")).toBe(true)
  })

  it("hyväksyy ulkomaisen yhtiömuodon", () => {
    /* Johannes 24.10.2026: "liittyva yritys on Kinland AS". */
    expect(kelpaaListalle("Kinland AS")).toBe(true)
    expect(kelpaaListalle("Leonhard Weiss Oü")).toBe(true)
  })

  it("hyväksyy muodottoman nimen kun se on monisanainen", () => {
    /* Johannes 24.10.2026: "Norlandia Health & Care lisataan yrityslistaan". */
    expect(kelpaaListalle("Norlandia Health & Care")).toBe(true)
    expect(kelpaaListalle("Senaatti-kiinteistöt")).toBe(false)
  })

  it("hylkää taloyhtiön", () => {
    /* Tiedote luettelee muitakin kohteita: toisen hankkeen taloyhtio. */
    expect(kelpaaListalle("Asunto Oy Oulun Graadi")).toBe(false)
    expect(kelpaaListalle("As Oy Nihdin Skyline")).toBe(false)
    /* Kiinteisto Oy on usein aito tilaaja. */
    expect(kelpaaListalle("Kiinteistö Oy Myyrinmäki")).toBe(true)
  })

  it("hylkää lauseen", () => {
    expect(kelpaaListalle("Neve Oy:n ja Merus Power")).toBe(false)
    expect(kelpaaListalle("Peabin ja YH Kotien yhteishanke")).toBe(false)
  })

  it("hylkää julkisyhteisön ja kuntanimen", () => {
    expect(kelpaaListalle("Helsingin kaupunki")).toBe(false)
    expect(kelpaaListalle("Pirkanmaan hyvinvointialue")).toBe(false)
    expect(kelpaaListalle("Siun sote kuntayhtymä")).toBe(false)
    expect(kelpaaListalle("Metsähallitus")).toBe(false)
  })

  it("erottelee nimet kentästä", () => {
    expect(erotteleNimet("Oteran Oy (2245597-0) // Kreate Oy")).toEqual(["Oteran Oy", "Kreate Oy"])
  })
})

describe("etsiTunnetutYritykset", () => {
  it("löytää tilaajan jota lause-pohjainen poiminta ei saanut", () => {
    const teksti =
      "Toivo Projektinhallinta Oy on allekirjoittanut KVR-urakkasopimuksen VAV Yhtymä Oy:n kanssa asuinkerrostalohankkeen toteuttamisesta Vantaan Aviapoliksen alueelle."
    expect(etsiTunnetutYritykset(teksti, LISTA)).toContain("VAV Yhtymä Oy")
  })

  it("ei lisää yritystä joka on jo kentässä", () => {
    const teksti = "Lujatalo Oy rakentaa Turun vankilan uuden sairaalan."
    expect(etsiTunnetutYritykset(teksti, LISTA, ["Lujatalo Oy"])).toEqual([])
  })

  it("tunnistaa saman yrityksen eri kirjoitusasussa", () => {
    /* Rivillä rakentajana "SRV", tiedotteessa "SRV YHTIÖT OYJ". */
    const teksti = "SRV YHTIÖT OYJ LEHDISTÖTIEDOTE 28.8.2025 Hyvinkää Areenan peruskivi muurattu."
    expect(etsiTunnetutYritykset(teksti, LISTA, ["SRV"])).toEqual([])
  })

  it("ei poimi katkennutta nimeä", () => {
    const teksti = "Uuden uimahallin jatkovalmistelu ja Kiinteistö Oy:n osuus hankkeesta."
    expect(etsiTunnetutYritykset(teksti, LISTA)).toEqual([])
  })

  it("ei osu sanan sisään", () => {
    expect(etsiTunnetutYritykset("Lujatalonpoika rakensi aitan pihalle kesällä.", LISTA)).toEqual([])
  })

  it("ei poimi samaa yritystä kahdesti eri muodossa", () => {
    const teksti =
      "Pohjola Rakennus Oy Suomi rakentaa kohteen. Pohjola Rakennus Oy Suomi vastaa myös pihatöistä."
    expect(etsiTunnetutYritykset(teksti, LISTA)).toEqual(["Pohjola Rakennus Oy Suomi"])
  })

  it("jättää liian lyhyen tekstin rauhaan", () => {
    expect(etsiTunnetutYritykset("Lujatalo Oy", LISTA)).toEqual([])
    expect(etsiTunnetutYritykset(null, LISTA)).toEqual([])
  })
})

describe("yritysRunko", () => {
  it("pudottaa yhtiömuodon vertailusta", () => {
    expect(yritysRunko("SRV Yhtiöt Oyj")).toBe("srv yhtiöt")
    expect(yritysRunko("Lujatalo Oy")).toBe("lujatalo")
  })
})
