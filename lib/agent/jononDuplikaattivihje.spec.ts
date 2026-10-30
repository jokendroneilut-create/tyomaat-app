import { describe, expect, it } from "vitest"

import {
  SADE_KM,
  duplikaattiehdotus,
  etaisyysKm,
  etsiVihjeet,
  samaLaji,
  type Vihjehanke,
} from "./jononDuplikaattivihje"

const hanke = (yli: Partial<Vihjehanke>): Vihjehanke => ({
  id: "h1",
  name: "Datakeskus Lohjalle",
  city: "Lohja",
  phase: "Rakenteilla",
  developer: "Hyperco Oy",
  property_type: "Datakeskus",
  latitude: 60.2,
  longitude: 24.07,
  ...yli,
})

/* Lohjan Virkkala, mitattu rekisterista. */
const EHDOKAS = {
  kunta: "Lohja",
  property_type: "Datakeskus",
  lat: 60.2,
  lon: 24.07,
}

describe("etaisyysKm", () => {
  it("antaa nollan samasta pisteesta", () => {
    expect(etaisyysKm(60.2, 24.07, 60.2, 24.07)).toBe(0)
  })

  it("antaa tunnetun valimatkan suuruusluokan", () => {
    /* Helsinki-Tampere on noin 160 km. */
    const d = etaisyysKm(60.17, 24.94, 61.5, 23.79)
    expect(d).toBeGreaterThan(150)
    expect(d).toBeLessThan(180)
  })
})

describe("samaLaji", () => {
  it("hyvaksyy saman tyypin", () => {
    expect(samaLaji("Datakeskus", hanke({ name: "Jokin muu nimi" }))).toBe(true)
  })

  /* `property_type` on epataysi: vanha rivi tunnistuu vain nimesta. */
  it("hyvaksyy nimen perusteella kun tyyppi puuttuu", () => {
    expect(samaLaji("Datakeskus", hanke({ property_type: null }))).toBe(true)
    expect(
      samaLaji("Datakeskus", hanke({ property_type: null, name: "Konesali Ouluun" }))
    ).toBe(true)
  })

  /*
   * TAMA ON KOKO RAJAUKSEN SYY. Mitattu 30.10.2026: ilman lajirajausta
   * 73 paria, joista "Polarnode Kuopio, Mustakorpi" <-> "Hoivakoti
   * Kuopioon" 0,0 km:n paassa. Laheisyys ei ole todiste samuudesta.
   */
  it("hylkaa eri lajin vaikka paikka olisi sama", () => {
    expect(
      samaLaji("Datakeskus", hanke({ property_type: "Hoivakoti", name: "Hoivakoti Kuopioon" }))
    ).toBe(false)
  })

  it("hylkaa kun ehdokkaalla ei ole tyyppia", () => {
    expect(samaLaji(null, hanke({}))).toBe(false)
  })

  /* Tuntemattomalle tyypille ei ole sanastoa, joten vain tyyppi kelpaa. */
  it("tuntemattomalla tyypilla vaatii taysin saman tyypin", () => {
    expect(samaLaji("Silta", hanke({ property_type: "Silta", name: "Mikä tahansa" }))).toBe(true)
    expect(samaLaji("Silta", hanke({ property_type: null, name: "Välijoen silta" }))).toBe(false)
  })
})

describe("etsiVihjeet", () => {
  it("loytaa saman paikan eri nimella", () => {
    const osumat = etsiVihjeet(EHDOKAS, [hanke({ name: "Lohjan datakeskus" })])
    expect(osumat).toHaveLength(1)
    expect(osumat[0].nimi).toBe("Lohjan datakeskus")
    expect(osumat[0].etaisyys_km).toBe(0)
    expect(osumat[0].tilaaja).toBe("Hyperco Oy")
  })

  it("ei palauta mitaan ilman koordinaattia", () => {
    expect(etsiVihjeet({ ...EHDOKAS, lat: null }, [hanke({})])).toEqual([])
    expect(etsiVihjeet(EHDOKAS, [hanke({ latitude: null })])).toEqual([])
  })

  it("rajaa sateeseen", () => {
    /* Noin 0,06 astetta leveyspiirissa on ~6,7 km. */
    const kauempi = hanke({ latitude: 60.26 })
    expect(etsiVihjeet(EHDOKAS, [kauempi])).toEqual([])
  })

  it("vaatii saman kunnan kun kunta tiedetaan molemmilta", () => {
    expect(etsiVihjeet(EHDOKAS, [hanke({ city: "Vihti" })])).toEqual([])
  })

  /* Puuttuva kunta ei ole peruste hylata ([[never-hide-on-missing-data]]). */
  it("ei hylkaa puuttuvan kunnan takia", () => {
    expect(etsiVihjeet(EHDOKAS, [hanke({ city: null })])).toHaveLength(1)
    expect(etsiVihjeet({ ...EHDOKAS, kunta: null }, [hanke({})])).toHaveLength(1)
  })

  it("jarjestaa lahimman ensin ja rajaa kolmeen", () => {
    const osumat = etsiVihjeet(EHDOKAS, [
      hanke({ id: "kauko", name: "Datakeskus A", latitude: 60.22 }),
      hanke({ id: "lahi", name: "Datakeskus B" }),
      hanke({ id: "keski", name: "Datakeskus C", latitude: 60.21 }),
      hanke({ id: "nelja", name: "Datakeskus D", latitude: 60.215 }),
    ])
    expect(osumat).toHaveLength(3)
    expect(osumat[0].hanke_id).toBe("lahi")
    expect(osumat.map((o) => o.hanke_id)).not.toContain("kauko")
  })
})

describe("duplikaattiehdotus", () => {
  it("palauttaa nullin ilman osumia", () => {
    expect(duplikaattiehdotus([])).toBeNull()
  })

  it("kirjaa perusteen ja sateen, jotta vihje on luettava myohemmin", () => {
    const e = duplikaattiehdotus(etsiVihjeet(EHDOKAS, [hanke({})]))
    expect(e?.peruste).toBe("koordinaatti")
    expect(e?.sade_km).toBe(SADE_KM)
    expect(e?.osumat).toHaveLength(1)
    expect(typeof e?.luotu).toBe("string")
  })
})
