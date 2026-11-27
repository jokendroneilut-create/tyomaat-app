import { describe, expect, it } from "vitest"
import { jaaOtsikkoJaTila, onPaivitysmerkinta } from "./ahtariKaava"

describe("onPaivitysmerkinta (D-454)", () => {
  it("tunnistaa sivun päivitysmerkinnän", () => {
    expect(onPaivitysmerkinta("- Sivua päivitetty marraskuu 2026")).toBe(true)
    expect(onPaivitysmerkinta("Sivu päivitetty 3.5.2026")).toBe(true)
    expect(onPaivitysmerkinta("Viimeksi päivitetty 12.11.2026")).toBe(true)
  })

  it("ei pidä kaavan nimeä päivitysmerkintänä", () => {
    expect(onPaivitysmerkinta("Tuomarniemen alueen asemakaava")).toBe(false)
    expect(onPaivitysmerkinta("Päivitettävä yleiskaava")).toBe(false)
  })
})

describe("jaaOtsikkoJaTila (D-454)", () => {
  it("erottaa hyväksymismerkinnän nimestä", () => {
    expect(jaaOtsikkoJaTila("Kimpilamminkankaan tuulivoimaosayleiskaava (hyv. KV 5.10.2026 § 82)")).toEqual({
      otsikko: "Kimpilamminkankaan tuulivoimaosayleiskaava",
      tila: "hyv. KV 5.10.2026 § 82",
      hyvaksytty: true,
    })
  })

  it("jättää nimeen kuuluvat sulkeet", () => {
    expect(jaaOtsikkoJaTila("Moksunniemen asemakaavan muutos (osakortteli 713)")).toEqual({
      otsikko: "Moksunniemen asemakaavan muutos (osakortteli 713)",
      tila: null,
      hyvaksytty: false,
    })
    expect(jaaOtsikkoJaTila("Juoleikonkankaan  tuulivoimaosayleiskaava").otsikko).toBe("Juoleikonkankaan tuulivoimaosayleiskaava")
  })
})
