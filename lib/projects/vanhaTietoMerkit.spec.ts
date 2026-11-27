import { describe, expect, it } from "vitest"
import { vanhaTietoMerkit } from "./vanhaTietoMerkit"

const NYT = new Date("2026-11-27T12:00:00Z")
const avaimet = (s: Parameters<typeof vanhaTietoMerkit>[0]) => vanhaTietoMerkit(s, NYT).map((m) => m.avain)

describe("vanhaTietoMerkit (D-461)", () => {
  it("tunnistaa Hilman sopimusmuutoksen tyypistä ja otsikosta", () => {
    expect(avaimet({ title: "The construction of 400 kV transmission line", metadata: { notice_type: "38", main_type: "Modification" } })).toEqual(["sopimusmuutos"])
    expect(avaimet({ title: "Sopimusmuutos: Eteläisen Postipuiston maanrakennusurakka", metadata: {} })).toEqual(["sopimusmuutos"])
    expect(avaimet({ title: "Eteläisen Postipuiston maanrakennusurakka", metadata: { notice_type: "16" } })).toEqual([])
  })

  it("tunnistaa jatkoluvan ja voimassaolon pidentämisen", () => {
    expect(avaimet({ title: "Jatkolupa: Urheilukentäntie 48a", permitNumber: "LP-758-2026-00251" })).toEqual(["jatkolupa"])
    expect(avaimet({ title: "Jatkoaikalupa: Jätevesijärjestelmä: Sossonniementie 174d" })).toEqual(["jatkolupa"])
    expect(avaimet({ title: "Luvan voimassaoloajan pidentäminen rakennustyön loppuunsaattamiseksi: Lylyniemenhaara 82" })).toEqual(["jatkolupa"])
    expect(avaimet({ title: "x", metadata: { operation: "Jatkolupa: Rakennusluvan numero 21-0386-R voimassaoloajan pidentäminen" } })).toEqual(["jatkolupa"])
  })

  it("tunnistaa muutoksen aiempaan lupaan", () => {
    const m = vanhaTietoMerkit(
      { title: "Rakentamisenaikainen muutos lupaan LP-858-2021-02367 (22-0047-R)", permitNumber: "LP-858-2026-01554" },
      NYT
    )
    expect(m.map((x) => x.avain)).toEqual(["muutos_aiempaan_lupaan"])
    expect(m[0].lyhyt).toBe("Muutos vuoden 2021 lupaan")
  })

  it("merkitsee yli vuoden vanhan lupahakemuksen, ei edellisen vuoden", () => {
    expect(vanhaTietoMerkit({ title: "vapaa-ajan-asuinrakennus", permitNumber: "LP-320-2020-00101" }, NYT)[0].lyhyt).toBe("Lupahakemus vuodelta 2020")
    expect(avaimet({ title: "sisatila-muutos", permitNumber: "LP-320-2024-00117" })).toEqual(["vanha_lupahakemus"])
    expect(avaimet({ title: "Rakentamislupa", permitNumber: "LP-208-2025-00344" })).toEqual([])
    expect(avaimet({ title: "Rakentamislupa", permitNumber: "LP-208-2026-00300" })).toEqual([])
  })

  it("ei merkitse tavallista hanketta eikä tuntematonta", () => {
    expect(avaimet({ title: "Asuinrakennuksen rakentaminen: Aunankierto 20", permitNumber: "LP-837-2026-03744" })).toEqual([])
    expect(avaimet({ title: "Poikkeamislupa: Kehtoranta 1" })).toEqual([])
    expect(avaimet({})).toEqual([])
    /* Oma tunnus tekstissä ei ole viittaus aiempaan lupaan. */
    expect(avaimet({ title: "Rakentamislupa LP-208-2026-00300", permitNumber: "LP-208-2026-00300" })).toEqual([])
  })
})
