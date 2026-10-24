import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  aloitus,
  jasennaJulkaisut,
  kustannus,
  lapaiseeSuodatuksen,
  tilapalvelutEhdokkaat,
  vaihe,
  valmistuminen,
} from "./fetchTilapalvelutSource"

/*
 * TAMPEREEN TILAPALVELUT (D-339). Fixture on neljä oikeaa juttua
 * rajapinnasta 24.10.2026 sellaisenaan.
 */

const data = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__/tilapalvelut/portfolio.json"), "utf8")
)
const julkaisut = jasennaJulkaisut(data)
const nimella = (alku: string) => julkaisut.find((j) => j.otsikko.startsWith(alku))!
const NYT = new Date("2026-10-24T12:00:00Z")

describe("jasennaJulkaisu", () => {
  it("lukee yhteyslaatikon kolmikkona ja sähköpostin painikkeesta", () => {
    expect(nimella("Kanjonin").yhteys).toEqual({
      name: "Heini Koiranen",
      title: "Hankepäällikkö",
      phone: "050 304 7050",
      email: "heini.koiranen@tilapa.fi",
    })
  })

  it("löytää kenttälohkon ensimmäisen kentän ilman <p>-avausta", () => {
    expect(nimella("Kanjonin").kentat.get("sijainti")).toBe("Ruovedenkatu 7")
    expect(nimella("Harjun").kentat.get("sijainti")).toBe("Nokiantie 22")
  })

  it("erottaa saman kappaleen peräkkäiset kentät", () => {
    const k = nimella("Kämmenniemen").kentat
    expect(k.get("putkiurakoitsija")).toBe("Tampereen Ilmastointimiehet Oy")
    expect(k.get("ilmanvaihtourakoitsija")).toBe("Ilmanvaihtotyöt A. Saarinen Oy")
  })

  it("ei vie kenttälohkoa eikä murupolkua kuvaukseen", () => {
    const t = nimella("Kanjonin").teksti
    expect(t.startsWith("Hervannan Ruovedenkadulla")).toBe(true)
    expect(t).not.toMatch(/Rakennuttaja|Jutellaanko|JTNDbmF2/)
  })
})

describe("kentät", () => {
  it("kustannus", () => {
    expect(kustannus("22 900 000 euroa")).toBe(22_900_000)
    expect(kustannus("Noin 9,2 miljoonaa euroa")).toBe(9_200_000)
    expect(kustannus("6 050 000")).toBe(6_050_000)
    expect(kustannus("Vapaa-aikakeskuksen osuus on 12 600 000 euroa")).toBe(12_600_000)
  })

  it("aloitus", () => {
    expect(aloitus("• Rakentaminen: Uudet rakennustyöt alkavat maaliskuussa 2027")).toBe("2027-03-01")
    expect(aloitus("Heinäkuu 2026 – marraskuu 2027")).toBe("2026-07-01")
    expect(aloitus("Rakennustyöt aloitettiin huhtikuussa 2024 ja rakennus valmistui kesäkuussa 2025.")).toBe("2024-04-01")
  })

  it("valmistuminen: myöhäisin vaihe voittaa", () => {
    expect(
      valmistuminen(
        "Ensimmäisen vaiheen, B- ja C-rakennuksien perusparannus, on valmistunut käyttöön elokuussa 2026. A-rakennuksen perusparannus valmistuu kesällä 2027."
      )
    ).toBe("2027-08-31")
    expect(valmistuminen("Heinäkuu 2026 – marraskuu 2027")).toBe("2027-11-30")
    expect(valmistuminen("Rakennustyöt alkoivat maaliskuussa 2024 ja päättyivät lokakuussa 2025.")).toBe("2025-10-31")
  })
})

describe("vaihe", () => {
  const j = { otsikko: "X", teksti: "", luokat: [] as number[] }
  it("tuleva hanke valitulla urakoitsijalla on sopimusvaiheessa", () => {
    expect(vaihe({ ...j, luokat: [46] }, "2027-03-01", "2028-10-31", null, NYT)).toBe("Sopimus myönnetty")
  })
  it("tuleva hanke jonka aloitus on mennyt on rakenteilla", () => {
    expect(vaihe({ ...j, luokat: [46] }, "2026-08-01", "2028-08-31", null, NYT)).toBe("Rakenteilla")
  })
  it("meneillään-luokan mennyt valmistuminen on valmis, otsikko ei riitä", () => {
    expect(vaihe({ ...j, luokat: [49] }, null, "2025-10-31", null, NYT)).toBe("Valmistunut")
    expect(
      vaihe({ otsikko: "Harjun koulun B- ja C-rakennukset valmistuivat", teksti: "", luokat: [49] }, null, "2027-08-31", null, NYT)
    ).toBe("Rakenteilla")
  })
  it("asiakastarina ilman aikataulua jää kesken olevaksi", () => {
    expect(vaihe({ ...j, luokat: [50] }, null, null, "Aki Hyrkkönen Oy", NYT)).toBe("Rakenteilla")
  })
})

describe("suodatus ja ehdokas", () => {
  it("kesken-luokat ohittavat ikkunan, asiakastarinat eivät", () => {
    const vanha = new Date("2024-03-01")
    const raja = new Date("2025-10-24")
    expect(lapaiseeSuodatuksen({ otsikko: "Kissanmaan koulun perusparannus", pvm: vanha, luokat: [49] }, raja)).toBe(true)
    expect(lapaiseeSuodatuksen({ otsikko: "Messukylän koulun perusparannus", pvm: vanha, luokat: [50] }, raja)).toBe(false)
    expect(lapaiseeSuodatuksen({ otsikko: "Kattojen kuntoa on helppo selvittää drone-kopterin avulla", pvm: null, luokat: [50] }, raja)).toBe(false)
  })

  it("Tampereen kaupunginosa ei ole kunta", () => {
    const [e] = tilapalvelutEhdokkaat(nimella("Tammelan"), NYT)
    expect(e.city).toBe("Tampere")
    expect(e.location).toBe("Ilmarinkatu 17, 33500 Tampere")
  })

  it("Kanjonin koulu", () => {
    const [e] = tilapalvelutEhdokkaat(nimella("Kanjonin"), NYT)
    expect(e).toMatchObject({
      city: "Tampere",
      location: "Ruovedenkatu 7, Tampere",
      developer: "Tampereen Tilapalvelut Oy",
      phase: "Sopimus myönnetty",
      construction_start: "2027-03-01",
      estimated_completion: "2028-10-31",
      estimated_cost: 22_900_000,
    })
    expect((e.metadata as any).contact_persons[0]).toMatchObject({ name: "Heini Koiranen", level: "project" })
  })

  it("Harjun koulu: pääurakoitsija ja aliurakoitsijat kentistä", () => {
    const [e] = tilapalvelutEhdokkaat(nimella("Harjun"), NYT)
    expect(e.builder).toBe("Rakennusliike J.Malm Oy")
    expect(e.phase).toBe("Rakenteilla")
    expect((e.metadata as any).aliurakoitsijat).toContainEqual(
      expect.objectContaining({ yritys: "Bravida Finland Oy", tyo: "sähköurakka" })
    )
    expect((e.metadata as any).architectural_design).toBe("Arkkitehtitoimisto Tähti-Set Oy")
  })
})
