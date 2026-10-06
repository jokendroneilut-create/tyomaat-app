import { describe, expect, it } from "vitest"

import { yrityksenYhteyshenkilot, type Yritysrekisteri } from "./yritysrekisteri"

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
