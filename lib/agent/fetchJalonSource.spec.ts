import { describe, expect, it } from "vitest"

import {
  jalonEhdokkaat,
  jasennaKohteet,
  kuntaOsoitteesta,
  onAjankohtainen,
  valmistumispaiva,
} from "./fetchJalonSource"

/* Rajapinnan oma muoto, lyhennettyna (mitattu 25.10.2026). */
const VASTAUS = [
  {
    id: 6442,
    status: "publish",
    link: "https://jalon.fi/tyomaatiedot/s-market_peltola/",
    title: { rendered: "S-Market Peltola" },
    content: {
      rendered:
        "<p><strong>Rakennuttaja:</strong> HOK Elanto<br />\n<strong>Osoite: </strong><span>Jäppilänkatu 40, 04410 Järvenpää<br />\n</span><strong>Puhelin: </strong>040 154 8872<br />\n<strong>Valmistuu 9/2026</strong></p>",
    },
  },
  {
    id: 7001,
    status: "draft",
    link: "https://jalon.fi/tyomaatiedot/luonnos/",
    title: { rendered: "Luonnos" },
    content: { rendered: "<p><strong>Rakennuttaja:</strong> Ei julkaistu</p>" },
  },
]

describe("jasennaKohteet", () => {
  it("lukee kentat yhdesta kohteesta", () => {
    const kohteet = jasennaKohteet(VASTAUS)
    expect(kohteet).toHaveLength(1)
    expect(kohteet[0]).toMatchObject({
      otsikko: "S-Market Peltola",
      rakennuttaja: "HOK Elanto",
      osoite: "Jäppilänkatu 40, 04410 Järvenpää",
      puhelin: "040 154 8872",
      valmistuu: "2026-09-30",
    })
  })

  it("ohittaa julkaisemattomat", () => {
    expect(jasennaKohteet(VASTAUS).some((k) => k.otsikko === "Luonnos")).toBe(false)
  })

  it("kestaa tyhjan vastauksen", () => {
    expect(jasennaKohteet(null)).toEqual([])
    expect(jasennaKohteet({ virhe: "ei" })).toEqual([])
  })
})

describe("valmistumispaiva", () => {
  it("antaa kuukauden viimeisen paivan", () => {
    expect(valmistumispaiva("Valmistuu 9/2026")).toBe("2026-09-30")
    expect(valmistumispaiva("Valmistuu 2/2028")).toBe("2028-02-29")
    expect(valmistumispaiva("Valmistuu 12/2027")).toBe("2027-12-31")
  })

  it("hylkaa mahdottoman kuukauden", () => {
    expect(valmistumispaiva("Valmistuu 13/2027")).toBeNull()
    expect(valmistumispaiva("ei päivää")).toBeNull()
  })
})

describe("kuntaOsoitteesta", () => {
  it("lukee kunnan postinumeron jalkeen", () => {
    expect(kuntaOsoitteesta("Jäppilänkatu 40, 04410 Järvenpää")).toBe("Järvenpää")
    expect(kuntaOsoitteesta("Paletinkierto 11 00430 Helsinki")).toBe("Helsinki")
  })

  it("lukee kunnan pilkun jalkeen ilman postinumeroa", () => {
    expect(kuntaOsoitteesta("Sepänkatu 3, Jyväskylä")).toBe("Jyväskylä")
    expect(kuntaOsoitteesta("Kirjavantie, 03400 Vihti")).toBe("Vihti")
  })

  it("kestaa kahden kadun osoitteen", () => {
    expect(kuntaOsoitteesta("Vartioharjuntie 13/Telatie 2, 00950 Helsinki")).toBe("Helsinki")
  })

  it("tuntematon nimi hylataan, ei arvata", () => {
    expect(kuntaOsoitteesta("Kuvitteellinen 1, 99999 Kuvitteela")).toBeNull()
    expect(kuntaOsoitteesta(null)).toBeNull()
  })
})

describe("onAjankohtainen", () => {
  const nyt = new Date("2026-10-25T00:00:00Z")
  const kohde = (valmistuu: string | null) =>
    ({ id: 1, otsikko: "x", osoite: null, rakennuttaja: null, puhelin: null, valmistuu, linkki: "" })

  it("tuleva valmistuminen kelpaa", () => {
    expect(onAjankohtainen(kohde("2027-03-31"), nyt)).toBe(true)
  })

  it("juuri valmistunut kelpaa viela", () => {
    expect(onAjankohtainen(kohde("2026-09-30"), nyt)).toBe(true)
  })

  it("yli puoli vuotta vanha pudotetaan", () => {
    expect(onAjankohtainen(kohde("2026-01-31"), nyt)).toBe(false)
  })

  it("ilman paivaa pidetaan", () => {
    expect(onAjankohtainen(kohde(null), nyt)).toBe(true)
  })
})

describe("jalonEhdokkaat", () => {
  const [kohde] = jasennaKohteet(VASTAUS)
  const [ehdokas] = jalonEhdokkaat(kohde)

  it("Jalon on rakentaja ja sivun rakennuttaja on tilaaja", () => {
    expect(ehdokas.builder).toBe("Jalon Group Oy")
    expect(ehdokas.developer).toBe("HOK Elanto")
  })

  it("vaihe on julkaisijan luettelosta", () => {
    expect(ehdokas.phase).toBe("Rakenteilla")
    expect(ehdokas.phase_authoritative).toBe(true)
  })

  it("tyomaan numero on rakenteisena, EI kuvauksessa", () => {
    expect(ehdokas.metadata.contact_persons).toEqual([
      expect.objectContaining({ phone: "040 154 8872", kind: "organization", title: "työmaa" }),
    ])
    expect(ehdokas.description).not.toContain("040 154 8872")
  })

  it("sijainti ja valmistuminen kentista", () => {
    expect(ehdokas.city).toBe("Järvenpää")
    expect(ehdokas.region).toBe("Uusimaa")
    expect(ehdokas.location).toBe("Jäppilänkatu 40, 04410 Järvenpää")
    expect(ehdokas.estimated_completion).toBe("2026-09-30")
  })

  it("rakennuttaja myos liittyvaksi yritykseksi", () => {
    expect(ehdokas.metadata.related_companies).toContain("HOK Elanto")
  })
})
