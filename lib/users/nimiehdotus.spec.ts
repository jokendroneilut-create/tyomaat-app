import { describe, expect, it } from "vitest"

import { nimiehdotus } from "./nimiehdotus"

describe("nimiehdotus", () => {
  it("jakaa etu- ja sukunimen", () => {
    expect(nimiehdotus("Samu Manninen")).toEqual({ etunimi: "Samu", sukunimi: "Manninen" })
  })

  it("sailyttaa kaksiosaisen sukunimen", () => {
    expect(nimiehdotus("Aino Mäki Virtanen")).toEqual({
      etunimi: "Aino",
      sukunimi: "Mäki Virtanen",
    })
  })

  /*
   * Mitattu 6.10.2026: nama ovat oikeita arvoja kannassa, kaikki
   * johdettu sahkopostiosoitteesta. Niita ei saa tarjota nimena.
   */
  it("ei ehdota sahkopostista johdettua roskaa", () => {
    expect(nimiehdotus("sladidasdriftteam")).toEqual({ etunimi: "", sukunimi: "" })
    expect(nimiehdotus("Jjuliahanninen")).toEqual({ etunimi: "", sukunimi: "" })
    expect(nimiehdotus("testi")).toEqual({ etunimi: "", sukunimi: "" })
    expect(nimiehdotus("johannessippola")).toEqual({ etunimi: "", sukunimi: "" })
  })

  it("sietaa tyhjan", () => {
    expect(nimiehdotus(null)).toEqual({ etunimi: "", sukunimi: "" })
    expect(nimiehdotus("")).toEqual({ etunimi: "", sukunimi: "" })
  })
})
