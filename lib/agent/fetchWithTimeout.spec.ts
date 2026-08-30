import { describe, expect, it } from "vitest"

import { REQUEST_TIMEOUT_MS, fetchWithTimeout } from "./fetchWithTimeout"

/* Palvelin joka ei vastaa koskaan, mutta kunnioittaa keskeytystä. */
const jumiPalvelin = (_url: string, init: any) =>
  new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("This operation was aborted")))
  })

describe("fetchWithTimeout", () => {
  it("katkaisee pyynnon joka ei palaa", async () => {
    await expect(
      fetchWithTimeout("https://esimerkki.fi", {}, { timeoutMs: 20, fetchImpl: jumiPalvelin })
    ).rejects.toThrow(/abort/i)
  })

  it("paastaa nopean vastauksen lapi", async () => {
    const tulos = await fetchWithTimeout(
      "https://esimerkki.fi",
      {},
      { timeoutMs: 500, fetchImpl: async () => ({ ok: true, status: 200 }) }
    )
    expect(tulos.status).toBe(200)
  })

  /* Kutsujan omat otsikot eivat saa kadota signaalin mukana. */
  it("sailyttaa kutsujan asetukset", async () => {
    let nakyi: any = null
    await fetchWithTimeout(
      "https://esimerkki.fi",
      { headers: { accept: "text/html" }, cache: "no-store" },
      {
        timeoutMs: 500,
        fetchImpl: async (_u: string, init: any) => {
          nakyi = init
          return { ok: true }
        },
      }
    )
    expect(nakyi.headers.accept).toBe("text/html")
    expect(nakyi.cache).toBe("no-store")
    expect(nakyi.signal).toBeDefined()
  })

  /*
   * Katto on mitoitettu hitaimman ONNISTUNEEN vastauksen mukaan
   * (24,1 s Tampereen CaseM), joten se ei saa laskea sen alle.
   */
  it("katto on vahintaan mitatun hitaimman vastauksen verran", () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(25 * 1000)
  })
})
