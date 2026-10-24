import { describe, it, expect } from "vitest"
import {
  valitseMuistutettavat,
  muistutuksenOtsikko,
  muistutuksenTeksti,
  ALOITUSPAIVA,
  type MuistutusEhdokas,
} from "./trialMuistutukset"

const NYT = new Date("2026-11-10T09:00:00Z").getTime()

/* Tunnus joka on luotu n paivaa sitten. */
function luotu(paiviaSitten: number): string {
  return new Date(NYT - paiviaSitten * 86400000).toISOString()
}

function ehdokas(yli: Partial<MuistutusEhdokas> = {}): MuistutusEhdokas {
  return {
    userId: "u1",
    email: "matti@yritys.fi",
    createdAt: luotu(9),
    tila: "testi",
    lukittu: false,
    ...yli,
  }
}

describe("valitseMuistutettavat", () => {
  it("lähettää ensimmäisen muistutuksen kun jäljellä on 21 päivää", () => {
    const [m] = valitseMuistutettavat([ehdokas()], NYT)
    expect(m.virstanpylvas).toBe(21)
    expect(m.paiviaJaljella).toBe(21)
  })

  it("ei lähetä ennen kuin rajapyykki tulee vastaan", () => {
    expect(valitseMuistutettavat([ehdokas({ createdAt: luotu(8) })], NYT)).toHaveLength(0)
  })

  it("lähettää toisen ja kolmannen muistutuksen omilla rajoillaan", () => {
    const toinen = valitseMuistutettavat([ehdokas({ createdAt: luotu(16), kasitellyt: [21] })], NYT)
    expect(toinen[0].virstanpylvas).toBe(14)
    expect(toinen[0].paiviaJaljella).toBe(14)

    const kolmas = valitseMuistutettavat(
      [ehdokas({ createdAt: luotu(23), kasitellyt: [21, 14] })],
      NYT
    )
    expect(kolmas[0].virstanpylvas).toBe(7)
    expect(kolmas[0].paiviaJaljella).toBe(7)
  })

  it("ei lähetä samaa virstanpylvästä kahdesti", () => {
    expect(valitseMuistutettavat([ehdokas({ kasitellyt: [21] })], NYT)).toHaveLength(0)
  })

  it("kertoo todellisen jäljellä olevan määrän kun ajo on myöhässä", () => {
    /* Laukaisu on iässä 9, mutta ajo tehdään vasta iässä 11. */
    const [m] = valitseMuistutettavat([ehdokas({ createdAt: luotu(11) })], NYT)
    expect(m.virstanpylvas).toBe(21)
    expect(m.paiviaJaljella).toBe(19)
  })

  it("lähettää vain kiireisimmän ja merkitsee vanhentuneet ohitetuiksi", () => {
    /* Ajo on ollut poikki: tunnus ohitti sekä 21:n että 14:n rajan. */
    const [m] = valitseMuistutettavat([ehdokas({ createdAt: luotu(17) })], NYT)
    expect(m.virstanpylvas).toBe(14)
    expect(m.vanhentuneet).toEqual([21])
  })

  it("ei lähetä muille kuin Trial-tilan asiakkaille", () => {
    for (const tila of ["maksava", "ei_maksava", null, undefined, ""]) {
      expect(valitseMuistutettavat([ehdokas({ tila: tila as any })], NYT)).toHaveLength(0)
    }
  })

  it("ei lähetä lukitulle tunnukselle", () => {
    expect(valitseMuistutettavat([ehdokas({ lukittu: true })], NYT)).toHaveLength(0)
  })

  it("ei lähetä adminille eikä myyjälle", () => {
    expect(valitseMuistutettavat([ehdokas({ rooli: "admin" })], NYT)).toHaveLength(0)
    expect(valitseMuistutettavat([ehdokas({ rooli: "seller" })], NYT)).toHaveLength(0)
  })

  it("ei lähetä kun kokeilu on jo ohi", () => {
    expect(valitseMuistutettavat([ehdokas({ createdAt: luotu(31) })], NYT)).toHaveLength(0)
  })

  it("ei lähetä takautuvasti rajapyykistä joka oli ohi jo käyttöönottopäivänä", () => {
    /*
     * Tunnus oli 20 vrk vanha kun ominaisuus otettiin käyttöön: 21 ja 14
     * päivän rajat olivat jo menneet, ne Johannes hoitaa käsin. Seitsemän
     * päivän raja tulee vastaan vasta käyttöönoton jälkeen.
     */
    const aloitus = "2026-11-01"
    const ika = (paivia: number) =>
      new Date(new Date(`${aloitus}T00:00:00Z`).getTime() - paivia * 86400000).toISOString()

    const nytAloituksessa = new Date(`${aloitus}T09:00:00Z`).getTime()
    expect(
      valitseMuistutettavat([ehdokas({ createdAt: ika(20) })], nytAloituksessa, aloitus)
    ).toHaveLength(0)

    const kolmePaivaaMyohemmin = nytAloituksessa + 3 * 86400000
    const [m] = valitseMuistutettavat(
      [ehdokas({ createdAt: ika(20) })],
      kolmePaivaaMyohemmin,
      aloitus
    )
    expect(m.virstanpylvas).toBe(7)
    expect(m.vanhentuneet).toEqual([])
  })

  it("ei lähetä ilman sähköpostiosoitetta", () => {
    expect(valitseMuistutettavat([ehdokas({ email: null })], NYT)).toHaveLength(0)
  })

  it("aloituspäivä on päivä jona ominaisuus otettiin käyttöön", () => {
    expect(ALOITUSPAIVA).toBe("2026-10-24")
  })
})

describe("viestin teksti", () => {
  it("käyttää laskettua lukua, ei virstanpylvästä", () => {
    expect(muistutuksenOtsikko(19)).toContain("19 päivää")
    expect(muistutuksenOtsikko(1)).toContain("1 päivä")
  })

  it("tervehtii etunimellä kun se on tiedossa", () => {
    const { text } = muistutuksenTeksti("Matti", 21, "https://app.tyomaat.fi")
    expect(text.startsWith("Hei Matti,")).toBe(true)
    expect(text).toContain("jäljellä vielä 21 päivää")
  })

  it("tulee toimeen ilman etunimeä", () => {
    const { text, html } = muistutuksenTeksti(null, 7, "https://app.tyomaat.fi")
    expect(text.startsWith("Hei,")).toBe(true)
    expect(html).toContain("https://app.tyomaat.fi")
  })
})
