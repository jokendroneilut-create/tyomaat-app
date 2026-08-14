import { describe, it, expect } from "vitest"
import { builderFromHeadline } from "./builderFromHeadline"

describe("builderFromHeadline", () => {
  /*
   * Uutislahteilla julkaisija on toimitus, joten urakoitsija on
   * poimittava otsikon rakenteesta. Mitatut muodot Rakennuslehdesta ja
   * kaupunkien uutisista 14.8.2026.
   */
  it("poimii urakoitsijan kun tilaaja on allatiivissa", () => {
    expect(builderFromHeadline("Hartela toteuttaa A-Kruunulle vähähiilisen asuinkerrostalon")).toBe("Hartela")
    expect(builderFromHeadline("Jatke rakentaa jälleen TVT Asunnoille – Turun Pernoon")).toBe("Jatke")
    expect(builderFromHeadline("Hartela rakentaa TA:lle kerrostalon Oulun Mäntylään")).toBe("Hartela")
  })

  /*
   * OMAPERUSTEINEN TUOTANTO EI TEE TEKIJASTA URAKOITSIJAA. Mitatut
   * tapaukset: naissa tekija rakentaa itselleen ja on rakennuttaja.
   */
  it("ei poimi omaperusteista tuotantoa", () => {
    expect(builderFromHeadline("Espoon Asunnot rakentaa 82 energiatehokasta vuokra-asuntoa")).toBeNull()
    expect(builderFromHeadline("PeeÄssä rakentaa S-marketin Neulamäkeen")).toBeNull()
  })

  /* Kunta on tilaaja vaikka lause olisi muodollisesti sama. */
  it("ei poimi kuntaa", () => {
    expect(builderFromHeadline("Espoo rakentaa Kojamolle koulun")).toBeNull()
  })

  it("ei poimi rakennuttamista eika suunnittelua", () => {
    expect(builderFromHeadline("Kojamo rakennuttaa Hartelalle kerrostalon")).toBeNull()
    expect(builderFromHeadline("Arkkitehdit suunnittelee Kojamolle kerrostalon")).toBeNull()
  })

  it("sietaa tyhjan", () => {
    expect(builderFromHeadline(null)).toBeNull()
    expect(builderFromHeadline("")).toBeNull()
  })
})
