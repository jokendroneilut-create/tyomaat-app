import { describe, expect, it } from "vitest"

import {
  osapuoltenYhteyshenkilot,
  yrityksenYhteyshenkilot,
  type Yritysrekisteri,
} from "./yritysrekisteri"

const rekisteri: Yritysrekisteri = new Map([
  [
    "skanska",
    [
      {
        name: "Markus Lipsanen",
        title: "Työpäällikkö",
        email: "markus.lipsanen@skanska.fi",
        phone: null,
        organization: "Skanska",
        level: "company" as const,
      },
    ],
  ],
])

describe("yrityksenYhteyshenkilot", () => {
  it("loytaa yrityksen urakoitsijakentasta", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Skanska Oy" }, rekisteri)).toHaveLength(1)
  })

  it("loytaa yrityksen rakennuttajakentasta", () => {
    expect(yrityksenYhteyshenkilot({ developer: "Skanska" }, rekisteri)).toHaveLength(1)
  })

  it("palauttaa tyhjan tuntemattomalle yritykselle", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Tuntematon Oy" }, rekisteri)).toEqual([])
    expect(yrityksenYhteyshenkilot({}, rekisteri)).toEqual([])
  })

  /* Taso on aina company, jotta merkinta ja mittarin neula osuvat oikein. */
  it("merkitsee tason yrityskohtaiseksi", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Skanska" }, rekisteri)[0].level).toBe("company")
  })
})

/* D-253: osapuolet omana ryhmanaan. Nimet ja numerot keksittyja. */
const osapuoliRekisteri: Yritysrekisteri = new Map([
  [
    "kattotyot",
    [
      {
        name: "Testi Henkilo",
        title: "Tyonjohtaja",
        email: null,
        phone: "040 000 0000",
        organization: "Kattotyot Oy",
        level: "company" as const,
      },
    ],
  ],
])

describe("osapuoltenYhteyshenkilot", () => {
  it("loytaa related_companies-osapuolen ja merkitsee roolin", () => {
    const tulos = osapuoltenYhteyshenkilot(
      { metadata: { related_companies: ["Kattotyot Oy (1111111-1)"] } },
      osapuoliRekisteri
    )
    expect(tulos).toHaveLength(1)
    expect(tulos[0].organization).toBe("Kattotyot Oy (osapuoli)")
    expect(tulos[0].group).toBe("osapuoli")
    expect(tulos[0].level).toBe("company")
  })

  it("kayttaa aliurakoitsijan tyota roolina", () => {
    const tulos = osapuoltenYhteyshenkilot(
      {
        metadata: {
          related_companies: ["Kattotyot Oy"],
          aliurakoitsijat: [{ yritys: "Kattotyot Oy", tyo: "vesikattotyot" }],
        },
      },
      osapuoliRekisteri
    )
    expect(tulos[0].organization).toBe("Kattotyot Oy (vesikattotyot)")
  })

  it("ei palauta urakoitsijaa osapuolena", () => {
    expect(
      osapuoltenYhteyshenkilot(
        { builder: "Kattotyot Oy", metadata: { related_companies: ["Kattotyot Oy"] } },
        osapuoliRekisteri
      )
    ).toEqual([])
  })

  /* Ostajapuolen rivi ei saa alkaa nayttaa osapuolta "yrityksen yhteyshenkilona". */
  it("yrityksenYhteyshenkilot ei lue related_companies-kenttaa", () => {
    expect(
      yrityksenYhteyshenkilot(
        { metadata: { related_companies: ["Kattotyot Oy"] } } as never,
        osapuoliRekisteri
      )
    ).toEqual([])
  })
})
