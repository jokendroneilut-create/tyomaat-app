import { describe, expect, it } from "vitest"

import { katselmointiMetadata, paatteleKaavanKatselmointi } from "./kaavanKatselmointi"

describe("paatteleKaavanKatselmointi", () => {
  const hanke = { phase: "Kaavoitus", needsReview: false, decisionStatus: "Ehdotus" }

  it("nostaa lainvoimaisen katselmointiin", () => {
    const tulos = paatteleKaavanKatselmointi(hanke, { vaihe: "Voimaantulo" })
    expect(tulos.toiminto).toBe("nosta")
    if (tulos.toiminto === "nosta") expect(tulos.lopputila.tila).toBe("lainvoimainen")
  })

  it("nostaa keskeytetyn katselmointiin", () => {
    const tulos = paatteleKaavanKatselmointi(hanke, { vaihe: "Kaavaprosessin keskeyttäminen" })
    expect(tulos.toiminto).toBe("nosta")
    if (tulos.toiminto === "nosta") expect(tulos.lopputila.tila).toBe("keskeytetty")
  })

  it("paivittaa pelkan vaiheen kun lopputilaa ei ole", () => {
    expect(paatteleKaavanKatselmointi(hanke, { vaihe: "Hyväksyminen" })).toEqual({
      toiminto: "paivita_vaihe",
      uusiVaihe: "Hyväksyminen",
    })
  })

  it("ei tee mitaan kun vaihe on jo sama", () => {
    expect(paatteleKaavanKatselmointi(hanke, { vaihe: "Ehdotus" }).toiminto).toBe("ei_mitaan")
  })

  it("ei nosta rivia uudelleen jos se on jo katselmoitavana", () => {
    const jo = { ...hanke, needsReview: true }
    expect(paatteleKaavanKatselmointi(jo, { vaihe: "Voimaantulo" }).toiminto).toBe("paivita_vaihe")
    expect(
      paatteleKaavanKatselmointi({ ...jo, decisionStatus: "Voimaantulo" }, { vaihe: "Voimaantulo" })
        .toiminto
    ).toBe("ei_mitaan")
  })

  it("ei paivita vaihetta taaksepain", () => {
    /* Mitattu: 9 paivitysta 208:sta olisi mennyt taaksepain. */
    const pitkalla = { phase: "Kaavoitus", needsReview: false, decisionStatus: "Hyväksyminen" }
    expect(paatteleKaavanKatselmointi(pitkalla, { vaihe: "Vireilletulo" }).toiminto).toBe("ei_mitaan")
    /* Eteenpain menee yha. */
    expect(paatteleKaavanKatselmointi(pitkalla, { vaihe: "Valitusaika" }).toiminto).toBe(
      "paivita_vaihe"
    )
    /* Tunnistamaton sanasto ei estä päivitystä. */
    expect(
      paatteleKaavanKatselmointi(pitkalla, { vaihe: "Kaavatyö jatkuu syksyllä" }).toiminto
    ).toBe("paivita_vaihe")
  })

  it("ei kirjoita kaava_tila-kenttaa (se siirtaisi hankkeen automaattisesti)", () => {
    const md = katselmointiMetadata(
      { decision_status: "Ehdotus" },
      "Kaava on saanut lainvoiman 20.10.2026",
      { tila: "lainvoimainen", paiva: "2026-10-20", todiste: "Kaava on saanut lainvoiman 20.10.2026" },
      new Date("2026-11-08T12:00:00Z")
    )
    expect(md.kaava_tila).toBeUndefined()
    expect(md.kaava_voimaantulo).toBe("2026-10-20")
    expect(md.kaava_lopputila.tila).toBe("lainvoimainen")
    expect(md.decision_status).toBe("Kaava on saanut lainvoiman 20.10.2026")
  })
})
