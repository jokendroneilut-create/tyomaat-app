import { describe, expect, it } from "vitest"

import { kohdeSivutLastmodeineen } from "./fetchT2hKohteetSource"
import { HAKEMATON, peruutusRaja, valitseHaettavat, type MuistiRivi } from "./t2hMuisti"

const rivi = (url: string, kasiteltyLastmod: string, hylatty = false): MuistiRivi => ({
  url,
  kasiteltyLastmod,
  hylatty,
  paivitetty: "2026-09-10T00:00:00.000Z",
})

const muistiksi = (rivit: MuistiRivi[]) => new Map(rivit.map((r) => [r.url, r]))

/*
 * UUSI KOHDE ENSIN (D-186). Koko muutoksen syy: sokeassa kierrossa uusi
 * kohde saattoi odottaa vuoroaan kuukausia.
 */
describe("valitseHaettavat", () => {
  it("hakee sitemapiin ilmestyneen kohteen ennen muita", () => {
    const sivut = [
      { url: "a", lastmod: "2026-09-10T10:00:00Z" },
      { url: "uusi", lastmod: "2026-01-01T00:00:00Z" },
    ]
    const valinta = valitseHaettavat(sivut, muistiksi([rivi("a", HAKEMATON)]), 1)

    expect(valinta).toEqual([{ url: "uusi", lastmod: "2026-01-01T00:00:00Z", syy: "uusi" }])
  })

  it("ei hae muuttumatonta sivua", () => {
    const sivut = [{ url: "a", lastmod: "2026-09-01T00:00:00Z" }]
    const muisti = muistiksi([rivi("a", "2026-09-01T00:00:00.000Z")])

    expect(valitseHaettavat(sivut, muisti, 2)).toEqual([])
  })

  it("hakee sivun jota on muutettu haun jälkeen", () => {
    const sivut = [{ url: "a", lastmod: "2026-09-10T00:00:00Z" }]
    const muisti = muistiksi([rivi("a", "2026-09-01T00:00:00.000Z")])

    expect(valitseHaettavat(sivut, muisti, 2)[0].syy).toBe("muuttunut")
  })

  it("järjestää uusi > hakematon > muuttunut > muuttunut-hylätty", () => {
    const sivut = [
      { url: "hylatty", lastmod: "2026-09-10T00:00:00Z" },
      { url: "muuttunut", lastmod: "2026-09-10T00:00:00Z" },
      { url: "hakematon", lastmod: "2025-01-01T00:00:00Z" },
      { url: "uusi", lastmod: "2024-01-01T00:00:00Z" },
    ]
    const muisti = muistiksi([
      rivi("hylatty", "2026-01-01T00:00:00.000Z", true),
      rivi("muuttunut", "2026-01-01T00:00:00.000Z"),
      rivi("hakematon", HAKEMATON),
    ])

    expect(valitseHaettavat(sivut, muisti, 4).map((v) => v.syy)).toEqual([
      "uusi",
      "hakematon",
      "muuttunut",
      "muuttunut-hylatty",
    ])
  })

  it("ottaa ryhmän sisällä uusimman ensin ja rajaa määrän", () => {
    const sivut = [
      { url: "vanha", lastmod: "2025-01-01T00:00:00Z" },
      { url: "tuore", lastmod: "2026-09-10T00:00:00Z" },
      { url: "keski", lastmod: "2026-03-01T00:00:00Z" },
    ]
    const muisti = muistiksi(sivut.map((s) => rivi(s.url, HAKEMATON)))

    expect(valitseHaettavat(sivut, muisti, 2).map((v) => v.url)).toEqual(["tuore", "keski"])
  })

  /* Ilman lastmodia muutosta ei voi todeta, joten paikkaa ei kuluteta. */
  it("ei hae haettua sivua jolta lastmod puuttuu", () => {
    const muisti = muistiksi([rivi("a", "2026-09-01T00:00:00.000Z")])
    expect(valitseHaettavat([{ url: "a", lastmod: null }], muisti, 2)).toEqual([])
  })
})

/*
 * Kaatuneen ajon merkinnät perutaan, jottei aikakatkaisu pudota uutta
 * kohdetta pois uusien joukosta.
 */
describe("peruutusRaja", () => {
  it("ei peru mitään kun edellinen ajo onnistui", () => {
    expect(peruutusRaja({ last_error_at: "2026-09-09T00:00:00Z", last_success_at: "2026-09-11T00:00:00Z" })).toBeNull()
    expect(peruutusRaja({ last_error_at: null, last_success_at: "2026-09-11T00:00:00Z" })).toBeNull()
  })

  it("perii viimeisimmän onnistumisen jälkeiset kun edellinen ajo kaatui", () => {
    expect(
      peruutusRaja({ last_error_at: "2026-09-12T00:00:00Z", last_success_at: "2026-09-11T00:00:00Z" })
    ).toBe("2026-09-11T00:00:00Z")
  })

  it("perii kaiken jos lähde ei ole koskaan onnistunut", () => {
    expect(peruutusRaja({ last_error_at: "2026-09-09T00:00:00Z", last_success_at: null })).toBe(HAKEMATON)
  })
})

describe("kohdeSivutLastmodeineen", () => {
  it("lukee kohdesivut ja niiden lastmodin, ohittaa alasivut", () => {
    const xml = `
      <url><loc>https://www.t2h.fi/asunto-oy-espoon-aurum</loc><lastmod>2026-09-10T09:40:01+03:00</lastmod></url>
      <url><loc>https://www.t2h.fi/asunto-oy-espoon-aurum/2h-s-kt-44-m2</loc><lastmod>2026-09-10T09:40:01+03:00</lastmod></url>
      <url><loc>https://www.t2h.fi/kiinteisto-oy-turun-halli/</loc></url>
      <url><loc>https://www.t2h.fi/yhteystiedot</loc><lastmod>2026-01-01T00:00:00+02:00</lastmod></url>`

    expect(kohdeSivutLastmodeineen(xml)).toEqual([
      { url: "https://www.t2h.fi/asunto-oy-espoon-aurum", lastmod: "2026-09-10T09:40:01+03:00" },
      { url: "https://www.t2h.fi/kiinteisto-oy-turun-halli/", lastmod: null },
    ])
  })
})
