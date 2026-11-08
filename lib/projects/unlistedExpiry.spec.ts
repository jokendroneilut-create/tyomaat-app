import { describe, expect, it } from "vitest"

import {
  UNLISTED_REASON,
  UNLISTED_THRESHOLD_DAYS,
  evaluateUnlisted,
  writesAllowed,
} from "./unlistedExpiry"

const NYT = new Date("2026-08-29T12:00:00Z")
const vrkSitten = (n: number) => new Date(NYT.getTime() - n * 86400000).toISOString()

const TERVE = { lastSuccessAt: vrkSitten(0.2), lastWriteAt: vrkSitten(0.2) }
const perus = {
  now: NYT,
  status: "active",
  phase: "Kaavoitus",
  source: TERVE,
}

describe("evaluateUnlisted", () => {
  it("vanhentaa hankkeen jota ei ole nahty kynnysta kauempaa", () => {
    expect(evaluateUnlisted({ ...perus, lastSeenAt: vrkSitten(UNLISTED_THRESHOLD_DAYS + 1) })).toBe("expire")
  })

  it("sailyttaa hankkeen joka nakyi eilen", () => {
    expect(evaluateUnlisted({ ...perus, lastSeenAt: vrkSitten(1) })).toBe("keep")
  })

  /* Juuri tama virhe tehtiin mittauksessa: Oulu lukee 2 sivua vuorokaudessa. */
  it("sailyttaa hankkeen jonka keraaja kay lapi hitaassa kierrossa", () => {
    expect(evaluateUnlisted({ ...perus, lastSeenAt: vrkSitten(20) })).toBe("keep")
  })

  /* Tyhja kentta ei ole todiste katoamisesta. */
  it("ei vanhenna kun last_seen_at puuttuu", () => {
    expect(evaluateUnlisted({ ...perus, lastSeenAt: null })).toBe("keep")
  })

  it("ei vanhenna pelkkaa listausrivia", () => {
    expect(
      evaluateUnlisted({ ...perus, lastSeenAt: vrkSitten(200), listingOnly: true })
    ).toBe("keep")
  })

  /*
   * Hiljainen lahdevika nayttaisi silta etta kaikki lahteen hankkeet
   * katosivat samana paivana. Liperi ja Mantta-Vilppula olivat tassa
   * tilassa 29.8.2026: onnistunut ajo, nolla kirjoitettua dokumenttia.
   */
  it("ei vanhenna kun lahde ei ole kirjoittanut mitaan", () => {
    expect(
      evaluateUnlisted({
        ...perus,
        lastSeenAt: vrkSitten(200),
        source: { lastSuccessAt: vrkSitten(0.2), lastWriteAt: vrkSitten(30) },
      })
    ).toBe("keep")
  })

  it("ei vanhenna kun lahdetta ei ole ajettu", () => {
    expect(
      evaluateUnlisted({
        ...perus,
        lastSeenAt: vrkSitten(200),
        source: { lastSuccessAt: vrkSitten(9), lastWriteAt: vrkSitten(9) },
      })
    ).toBe("keep")
  })

  /* Hanke voi olla monessa lahteessa; yksi riittaa pitamaan sen elossa. */
  it("ei vanhenna kun toinen lahde on nahnyt hankkeen", () => {
    expect(
      evaluateUnlisted({ ...perus, lastSeenAt: vrkSitten(200), otherSourceSeenAt: vrkSitten(2) })
    ).toBe("keep")
  })

  it("ei koske valmistuneeseen eika jo vanhentuneeseen muusta syysta", () => {
    expect(evaluateUnlisted({ ...perus, phase: "Valmistunut", lastSeenAt: vrkSitten(200) })).toBe("keep")
    expect(
      evaluateUnlisted({ ...perus, status: "expired", expiredReason: "Kilpailutus vanheni", lastSeenAt: vrkSitten(200) })
    ).toBe("keep")
  })

  /* Kaava voi palata listalle: valitus hylattiin, tyo jatkuu. */
  it("palauttaa hankkeen kun dokumentti nakyy taas", () => {
    expect(
      evaluateUnlisted({
        ...perus,
        status: "expired",
        expiredReason: UNLISTED_REASON,
        lastSeenAt: vrkSitten(1),
      })
    ).toBe("revive")
  })

  it("ei palauta jos dokumentti on yha kadoksissa", () => {
    expect(
      evaluateUnlisted({
        ...perus,
        status: "expired",
        expiredReason: UNLISTED_REASON,
        lastSeenAt: vrkSitten(200),
      })
    ).toBe("keep")
  })
})

describe("writesAllowed", () => {
  /*
   * Kytkin voittaa aina. Ilman tata cron ehtisi vanhentaa ensimmaisen
   * eran ennen kuin kukaan on lukenut yhtaan rivia.
   */
  it("ei kirjoita kun kytkin on pois", () => {
    expect(writesAllowed(false, false)).toBe(false)
    expect(writesAllowed(false, true)).toBe(false)
  })

  it("kirjoittaa vain kun kytkin on paalla eika kuivaharjoitusta pyydetty", () => {
    expect(writesAllowed(true, false)).toBe(true)
    expect(writesAllowed(true, true)).toBe(false)
  })
})

/*
 * VASTA TOIPUNUT LAHDE (D-397). Johannes 8.11.2026: "lähteen täytyy
 * pystyä onnistumaan ja toteamaan muutos jotta se saa muuttaa vaihetta".
 */
describe("evaluateUnlisted - toipunut lahde", () => {
  /* Sama kiintea NYT kuin muissa testeissa, muuten lahde nayttaa kuolleelta. */
  const kadonnut = {
    now: NYT,
    status: "active",
    phase: "Kaavoitus",
    lastSeenAt: vrkSitten(90),
  }

  it("ei vanhenna kun lahde on juuri toipunut virheesta", () => {
    /* Vaylan 403 kesti 22 vrk; heti sen jalkeen lahde nayttaa terveelta. */
    expect(
      evaluateUnlisted({
        ...kadonnut,
        source: { lastSuccessAt: vrkSitten(0.2), lastWriteAt: vrkSitten(0.2), lastErrorAt: vrkSitten(1) },
      })
    ).toBe("keep")
  })

  it("vanhentaa kun virheesta on kulunut kokonainen kierros", () => {
    expect(
      evaluateUnlisted({
        ...kadonnut,
        source: { lastSuccessAt: vrkSitten(0.2), lastWriteAt: vrkSitten(0.2), lastErrorAt: vrkSitten(20) },
      })
    ).toBe("expire")
  })

  it("vanhentaa kun lahde ei ole koskaan epaonnistunut", () => {
    expect(
      evaluateUnlisted({
        ...kadonnut,
        source: { lastSuccessAt: vrkSitten(0.2), lastWriteAt: vrkSitten(0.2), lastErrorAt: null },
      })
    ).toBe("expire")
  })

  it("ei vanhenna kun lahde on epaonnistunut juuri nyt", () => {
    /* Tama oli jo ennestaan: epaonnistuva lahde ei vanhenna mitaan. */
    expect(
      evaluateUnlisted({
        ...kadonnut,
        source: { lastSuccessAt: vrkSitten(22), lastWriteAt: vrkSitten(22), lastErrorAt: vrkSitten(0.1) },
      })
    ).toBe("keep")
  })
})
