import { describe, expect, it } from "vitest"

import {
  akselinYlaraja,
  jaksonLuvut,
  muutosProsentti,
  paivasarja,
  paivittainenKaytto,
} from "./kayttoyhteenveto"

const tapahtuma = (
  user: string,
  aika: string,
  tyyppi = "pageview",
  kesto: number | null = 60
) => ({ user_id: user, event_type: tyyppi, created_at: aika, duration_seconds: kesto })

describe("paivittainenKaytto", () => {
  /* Juuri se nakyma jota myyja tarvitsee: paivat ja minuutit. */
  it("kokoaa kirjautumiset ja ajan paivittain, uusin ensin", () => {
    const rivit = paivittainenKaytto([
      tapahtuma("a", "2026-09-01T08:00:00Z", "login", null),
      tapahtuma("a", "2026-09-01T08:00:05Z", "pageview", 300),
      tapahtuma("a", "2026-09-02T09:00:00Z", "login", null),
      tapahtuma("a", "2026-09-02T09:00:05Z", "pageview", 360),
      tapahtuma("a", "2026-09-03T10:00:00Z", "pageview", 540),
    ])
    expect(rivit.map((r) => r.paiva)).toEqual(["2026-09-03", "2026-09-02", "2026-09-01"])
    expect(rivit[2]).toMatchObject({ kirjautumisia: 1, sivulatauksia: 1, sekunteja: 300 })
    expect(rivit[0]).toMatchObject({ kirjautumisia: 0, sekunteja: 540 })
  })

  /* Yli 30 minuutin tauko aloittaa uuden istunnon, kuten GA:ssa. */
  it("laskee istunnot tauosta", () => {
    const rivit = paivittainenKaytto([
      tapahtuma("a", "2026-09-01T08:00:00Z"),
      tapahtuma("a", "2026-09-01T08:20:00Z"),
      tapahtuma("a", "2026-09-01T09:30:00Z"),
    ])
    expect(rivit[0].istuntoja).toBe(2)
  })

  it("kestaa tyhjan syotteen", () => {
    expect(paivittainenKaytto([])).toEqual([])
  })
})

describe("paivasarja", () => {
  it("tayttaa myos paivat joilta ei ole tapahtumia", () => {
    const sarja = paivasarja(
      [tapahtuma("a", "2026-09-01T08:00:00Z"), tapahtuma("b", "2026-09-03T08:00:00Z")],
      { alku: "2026-09-01", loppu: "2026-09-03" }
    )
    expect(sarja.map((r) => r.paiva)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"])
    expect(sarja[1]).toMatchObject({ kayttajia: 0, istuntoja: 0 })
  })

  it("laskee eri kayttajat paivakohtaisesti", () => {
    const sarja = paivasarja(
      [
        tapahtuma("a", "2026-09-01T08:00:00Z"),
        tapahtuma("a", "2026-09-01T08:10:00Z"),
        tapahtuma("b", "2026-09-01T09:00:00Z"),
      ],
      { alku: "2026-09-01", loppu: "2026-09-01" }
    )
    expect(sarja[0].kayttajia).toBe(2)
    /* a:n kaksi tapahtumaa 10 min valein = yksi istunto, b:lla oma. */
    expect(sarja[0].istuntoja).toBe(2)
  })

  it("rajaa jakson ulkopuoliset pois", () => {
    const sarja = paivasarja(
      [tapahtuma("a", "2026-08-30T08:00:00Z"), tapahtuma("a", "2026-09-01T08:00:00Z")],
      { alku: "2026-09-01", loppu: "2026-09-01" }
    )
    expect(sarja[0].sivulatauksia).toBe(1)
  })
})

describe("jaksonLuvut", () => {
  it("laskee keskimaaraisen istunnon keston", () => {
    const tap = [
      tapahtuma("a", "2026-09-01T08:00:00Z", "pageview", 120),
      tapahtuma("a", "2026-09-01T12:00:00Z", "pageview", 240),
    ]
    const sarja = paivasarja(tap, { alku: "2026-09-01", loppu: "2026-09-01" })
    const luvut = jaksonLuvut(sarja, tap, { alku: "2026-09-01", loppu: "2026-09-01" })
    expect(luvut.istuntoja).toBe(2)
    expect(luvut.sekunteja).toBe(360)
    expect(luvut.keskiIstuntoSek).toBe(180)
    expect(luvut.kayttajia).toBe(1)
  })

  it("ei jaa nollalla kun istuntoja ei ole", () => {
    const luvut = jaksonLuvut([], [], { alku: "2026-09-01", loppu: "2026-09-01" })
    expect(luvut.keskiIstuntoSek).toBe(0)
  })
})

describe("muutosProsentti", () => {
  it("laskee muutoksen edelliseen jaksoon", () => {
    expect(muutosProsentti(120, 100)).toBe(20)
    expect(muutosProsentti(80, 100)).toBe(-20)
  })

  /* Nollasta kasvu ei ole prosentti, joten sita ei keksita. */
  it("palauttaa null kun vertailukohta on nolla", () => {
    expect(muutosProsentti(50, 0)).toBeNull()
  })
})

describe("akselinYlaraja", () => {
  it("pyoristaa ylospain tasalukuun", () => {
    expect(akselinYlaraja(47)).toBe(50)
    expect(akselinYlaraja(342)).toBe(400)
    expect(akselinYlaraja(2717)).toBe(3000)
  })

  /* Pieni huippu ei saa hypata kaksinkertaiseksi. */
  it("puolittaa askeleen kun huippu on juuri suuruusluokan ylapuolella", () => {
    expect(akselinYlaraja(12)).toBe(15)
    expect(akselinYlaraja(105)).toBe(150)
  })

  it("ei palauta nollaa", () => {
    expect(akselinYlaraja(0)).toBeGreaterThan(0)
    expect(akselinYlaraja(1)).toBe(1)
  })
})
