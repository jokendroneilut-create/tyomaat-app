import { describe, expect, it } from "vitest"

import { paivitettyKuvaus } from "./kuvauksenPaivitys"

const pitka = "Plug Power Finland Site 1 Oy suunnittelee Porvoon Tolkkisiin noin 60 megawatin e-metaanin tuotantolaitosta. ".repeat(10)

describe("paivitettyKuvaus", () => {
  it("korvaa tyngän saman lähteen täydentyneellä tekstillä", () => {
    expect(
      paivitettyKuvaus({
        nykyinen: "Tämä sivu täydentyy myöhemmin. LVV-U/120061/2026",
        lahteenEdellinen: "Tämä sivu täydentyy myöhemmin. LVV-U/120061/2026",
        uusi: pitka,
        samaLahde: true,
      })
    ).toBe(pitka.trim())
  })

  it("korvaa koskemattoman lyhyen kuvauksen pidemmällä", () => {
    const vanha = "YVA-hanke (Datakeskukset). Ympäristövaikutusten arviointi käynnissä."
    expect(paivitettyKuvaus({ nykyinen: vanha, lahteenEdellinen: vanha, uusi: pitka, samaLahde: true })).toBe(pitka.trim())
  })

  it("ei koske käsin muokattuun kuvaukseen", () => {
    expect(
      paivitettyKuvaus({ nykyinen: "Käsin kirjoitettu kuvaus verkkohaun pohjalta.", lahteenEdellinen: "Lyhyt lähde.", uusi: pitka, samaLahde: true })
    ).toBeNull()
  })

  it("ei ota toisen lähteen tekstiä", () => {
    expect(paivitettyKuvaus({ nykyinen: "Lyhyt.", lahteenEdellinen: "Lyhyt.", uusi: pitka, samaLahde: false })).toBeNull()
  })

  it("ei lyhennä vähänkään (päättyneen YVA:n supistunut sivu)", () => {
    const vanha = pitka + " Lisätietoja hankkeen sivulla."
    expect(paivitettyKuvaus({ nykyinen: vanha, lahteenEdellinen: vanha, uusi: pitka, samaLahde: true })).toBeNull()
  })

  it("ei lyhennä eikä vaihda tynkään", () => {
    expect(paivitettyKuvaus({ nykyinen: pitka, lahteenEdellinen: pitka, uusi: "Lyhyt teksti.", samaLahde: true })).toBeNull()
    expect(paivitettyKuvaus({ nykyinen: pitka, lahteenEdellinen: pitka, uusi: "Tämä sivu täydentyy myöhemmin.", samaLahde: true })).toBeNull()
  })

  it("päivittää tilarivin vaikka teksti on yhtä pitkä", () => {
    const vanha = `YVA-menettelyn tila: Vireillä.\n\n${pitka}`
    const uusi = `YVA-menettelyn tila: Arviointiohjelma.\n\n${pitka}`
    expect(paivitettyKuvaus({ nykyinen: vanha, lahteenEdellinen: vanha, uusi, samaLahde: true })).toBe(uusi.trim())
  })

  it("ei tee mitään kun teksti on sama", () => {
    expect(paivitettyKuvaus({ nykyinen: pitka, lahteenEdellinen: pitka, uusi: `  ${pitka}  `, samaLahde: true })).toBeNull()
  })
})
