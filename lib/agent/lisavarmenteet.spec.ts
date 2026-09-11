import { X509Certificate } from "node:crypto"
import tls from "node:tls"
import { describe, expect, it } from "vitest"

import {
  LE_ROOT_YE_RISTI_X2,
  LE_YE1,
  LE_YE2,
  LE_YE3,
  LE_YE_KETJU,
  LE_YE_SORMENJALJET,
} from "./lisavarmenteet"

/*
 * KETJU TODENNETAAN ILMAN VERKKOA (D-185): jokainen YE-välivarmenne on
 * Root YE:n allekirjoittama, ja Root YE on ISRG Root X2:n allekirjoittama.
 * X2:n on löydyttävä Noden omasta juurivarastosta - muuten ketju ei
 * päättyisi luotettuun juureen ja koko lisäys olisi hyödytön.
 */
const rootYe = new X509Certificate(LE_ROOT_YE_RISTI_X2)
const isrgX2 = tls.rootCertificates
  .map((pem) => new X509Certificate(pem))
  .find((x) => /CN=ISRG Root X2/.test(x.subject))

describe("Let's Encrypt YE -ketju", () => {
  it("löytää ISRG Root X2:n Noden juurivarastosta", () => {
    expect(isrgX2).toBeDefined()
  })

  it("Root YE on X2:n allekirjoittama", () => {
    expect(rootYe.checkIssued(isrgX2!)).toBe(true)
    expect(rootYe.verify(isrgX2!.publicKey)).toBe(true)
  })

  it.each([
    ["YE1", LE_YE1],
    ["YE2", LE_YE2],
    ["YE3", LE_YE3],
  ])("%s on Root YE:n allekirjoittama", (_nimi, pem) => {
    const ye = new X509Certificate(pem)
    expect(ye.checkIssued(rootYe)).toBe(true)
    expect(ye.verify(rootYe.publicKey)).toBe(true)
    expect(ye.ca).toBe(true)
  })

  /* Kiinnitetyt sormenjäljet: vaihdettu varmenne ei mene läpi huomaamatta. */
  it("vastaa kiinnitettyjä sormenjälkiä", () => {
    expect(new X509Certificate(LE_YE1).fingerprint256).toBe(LE_YE_SORMENJALJET.LE_YE1)
    expect(new X509Certificate(LE_ROOT_YE_RISTI_X2).fingerprint256).toBe(
      LE_YE_SORMENJALJET.LE_ROOT_YE_RISTI_X2
    )
    expect(LE_YE_KETJU).toHaveLength(4)
  })

  /*
   * Vanheneminen huomataan testissä eikä tuotannossa: kaatuu 60 vrk ennen
   * kuin ensimmäinen varmenne vanhenee.
   */
  it("on voimassa vähintään 60 vrk", () => {
    const raja = Date.now() + 60 * 864e5
    for (const pem of LE_YE_KETJU) {
      expect(new Date(new X509Certificate(pem).validTo).getTime()).toBeGreaterThan(raja)
    }
  })
})
