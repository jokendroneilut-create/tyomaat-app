import { describe, expect, it } from "vitest"

import {
  kokoaYritykset,
  onValmistunut,
  ryhmitteleHankkeet,
  suodataYritykset,
  valmistumisKuukausi,
  yrityksenHenkilot,
  type ProjektinTiedot,
  type RekisteriRivi,
  type VerkostoHanke,
} from "./yritysverkosto"

/* Kaikki nimet, numerot ja osoitteet ovat keksittyja. */
const rekisteri: RekisteriRivi[] = [
  {
    avain: "tilaaja",
    yritys: "Tilaaja",
    nimi: "Testi Henkilo",
    nimike: "Projektipaallikko",
    email: "testi.henkilo@example.fi",
    puhelin: "040 000 0001",
    lahde: "https://example.fi/yhteystiedot",
  },
]

const hankkeet: VerkostoHanke[] = [
  {
    id: "h1",
    developer: "Tilaaja Oy",
    builder: "Urakka Oy",
    related_companies: ["Kattotyot Oy (1111111-1)"],
    aliurakoitsijat: [{ yritys: "Kattotyot Oy", tyo: "vesikattotyot" }],
    contact_persons: [
      {
        name: "Testi Henkilo",
        email: "TESTI.HENKILO@example.fi",
        organization: "Tilaaja Oy",
      },
      { name: "Malli Ihminen", phone: "040 000 0002", organization: "Urakka Oy" },
      /* Rekisterista kopioitu rivi ei ole hankkeen oma. */
      { name: "Kopio Rivi", email: "kopio@example.fi", organization: "Urakka Oy", level: "company" },
      /* Organisaatio jota ei ole listalla ei luo yritysta. */
      { name: "Kunnan Tarkastaja", email: "t@example.fi", organization: "Esimerkkikunta", role: "authority" },
    ],
  },
  { id: "h2", developer: "Tilaaja", builder: "Tilaaja Oy" },
  { id: "h3", builder: "Urakka", related_companies: ["Tilaaja Oy"] },
]

describe("kokoaYritykset", () => {
  const verkosto = kokoaYritykset(hankkeet, rekisteri)

  it("kokoaa yritykset rekisterista ja kaikista rooleista", () => {
    expect([...verkosto.keys()].sort()).toEqual(["kattotyot", "tilaaja", "urakka"])
    expect(verkosto.has("esimerkkikunta")).toBe(false)
  })

  it("laskee hankkeet rooleittain ja eri hankkeet kerran", () => {
    const tilaaja = verkosto.get("tilaaja")!
    expect(tilaaja.rooleittain).toEqual({ rakennuttaja: 2, paaurakoitsija: 1, osapuoli: 1 })
    expect(tilaaja.hankkeita).toBe(3)

    const katto = verkosto.get("kattotyot")!
    expect(katto.hankkeet).toEqual([{ projectId: "h1", rooli: "osapuoli", tyo: "vesikattotyot" }])
  })

  it("valitsee yleisimman kirjoitusasun nimeksi", () => {
    expect(verkosto.get("tilaaja")!.nimi).toBe("Tilaaja Oy")
    expect(verkosto.get("urakka")!.nimi).toBe("Urakka Oy")
  })

  it("liittaa hankkeen yhteyshenkilot organisaation avaimella", () => {
    const urakka = verkosto.get("urakka")!
    expect(urakka.hankehenkilot.map((h) => h.nimi)).toEqual(["Malli Ihminen"])
    expect(urakka.henkiloita).toBe(1)
  })

  it("yhdistaa rekisterin ja hankkeen saman henkilon sahkopostilla", () => {
    const henkilot = yrityksenHenkilot(verkosto.get("tilaaja")!)
    expect(henkilot).toHaveLength(1)
    expect(henkilot[0]).toMatchObject({
      nimi: "Testi Henkilo",
      rekisterissa: true,
      hankkeilta: ["h1"],
      puhelin: "040 000 0001",
    })
  })
})

describe("yrityksenHenkilot", () => {
  it("kerää saman ihmisen hankkeet yhdelle riville ja tayttaa puuttuvat tiedot", () => {
    const henkilot = yrityksenHenkilot({
      rekisteri: [],
      hankehenkilot: [
        { nimi: "Malli Ihminen", nimike: null, email: null, puhelin: null, projectId: "a", viranomainen: false },
        { nimi: "malli  ihminen", nimike: "Vastaava", email: null, puhelin: "040 000 0003", projectId: "b", viranomainen: false },
      ],
    })
    expect(henkilot).toHaveLength(1)
    expect(henkilot[0]).toMatchObject({ nimike: "Vastaava", puhelin: "040 000 0003", hankkeilta: ["a", "b"] })
  })
})

describe("suodataYritykset", () => {
  const verkosto = kokoaYritykset(hankkeet, rekisteri)

  it("jarjestaa hankemaaran mukaan", () => {
    expect(suodataYritykset(verkosto.values(), "").map((y) => y.avain)).toEqual([
      "tilaaja",
      "urakka",
      "kattotyot",
    ])
  })

  it("hakee nimesta ja avaimesta", () => {
    expect(suodataYritykset(verkosto.values(), "katto").map((y) => y.avain)).toEqual(["kattotyot"])
    expect(suodataYritykset(verkosto.values(), "Urakka Oy").map((y) => y.avain)).toEqual(["urakka"])
  })
})

describe("ryhmitteleHankkeet", () => {
  const tiedot = new Map<string, ProjektinTiedot>(
    [
      { id: "a", name: "Bravo", city: "Testila", phase: "Kaavoitus", status: "active", is_public: true, estimated_completion: null },
      { id: "b", name: "Alfa", city: "Testila", phase: "Rakenteilla", status: "active", is_public: true, estimated_completion: "2027-06-30" },
      { id: "c", name: "Charlie", city: null, phase: "Valmistunut", status: "active", is_public: true, estimated_completion: null },
      { id: "d", name: "Delta", city: null, phase: "Rakenteilla", status: "completed", is_public: true, estimated_completion: null },
    ].map((t) => [t.id, t])
  )

  it("ryhmittelee rooleittain, keskeneraiset ensin ja valmistuneet loppuun", () => {
    const ryhmat = ryhmitteleHankkeet(
      [
        { projectId: "c", rooli: "rakennuttaja", tyo: null },
        { projectId: "a", rooli: "rakennuttaja", tyo: null },
        { projectId: "b", rooli: "rakennuttaja", tyo: null },
        { projectId: "d", rooli: "osapuoli", tyo: "sahkotyot" },
        { projectId: "puuttuu", rooli: "paaurakoitsija", tyo: null },
      ],
      tiedot
    )
    expect(ryhmat.map((r) => r.otsikko)).toEqual(["Rakennuttaja", "Osapuoli"])
    expect(ryhmat[0].rivit.map((r) => r.id)).toEqual(["b", "a", "c"])
    expect(ryhmat[0].rivit[2].valmistunut).toBe(true)
    expect(ryhmat[1].rivit[0]).toMatchObject({ id: "d", tyo: "sahkotyot", valmistunut: true })
  })
})

describe("apufunktiot", () => {
  it("tunnistaa valmistuneen statuksesta tai vaiheesta", () => {
    expect(onValmistunut({ status: "completed", phase: "Rakenteilla" })).toBe(true)
    expect(onValmistunut({ status: "active", phase: "Valmistunut" })).toBe(true)
    expect(onValmistunut({ status: "active", phase: "Rakenteilla" })).toBe(false)
  })

  it("muotoilee valmistumisen kuukaudeksi", () => {
    expect(valmistumisKuukausi("2027-06-30")).toBe("6/2027")
    expect(valmistumisKuukausi(null)).toBeNull()
  })
})
