import { describe, expect, it } from "vitest"

import { lahteenTila, onRikki, VIRHEEN_TUOREUS_MS } from "./lahteenTila"

const NYT = new Date("2026-09-11T12:00:00Z").getTime()
const sitten = (tuntia: number) => new Date(NYT - tuntia * 3600e3).toISOString()

describe("lahteenTila", () => {
  it("on ok kun viimeisin on onnistuminen", () => {
    expect(lahteenTila({ enabled: true, last_success_at: sitten(1), last_error_at: sitten(5) }, NYT)).toBe("ok")
  })

  it("on rikki kun viimeisin on tuore virhe", () => {
    expect(lahteenTila({ enabled: true, last_success_at: sitten(200), last_error_at: sitten(20) }, NYT)).toBe("failing")
  })

  /* Uusi lähde joka ei ole koskaan onnistunut (T2H 9.9.2026). */
  it("on rikki kun onnistumista ei ole koskaan ollut", () => {
    expect(lahteenTila({ enabled: true, last_success_at: null, last_error_at: sitten(48) }, NYT)).toBe("failing")
  })

  it("siirtää yli viikon vanhan virheen omaan tilaansa", () => {
    const vanha = new Date(NYT - VIRHEEN_TUOREUS_MS - 3600e3).toISOString()
    expect(lahteenTila({ enabled: true, last_success_at: null, last_error_at: vanha }, NYT)).toBe("stale")
  })

  it("ei laske pois kytkettyä rikkinäiseksi", () => {
    expect(lahteenTila({ enabled: false, last_error_at: sitten(1) }, NYT)).toBe("disabled")
  })

  it("on ok ilman yhtään ajoa", () => {
    expect(lahteenTila({ enabled: true }, NYT)).toBe("ok")
  })
})

describe("onRikki", () => {
  it("on tosi vain tuoreelle virheelle", () => {
    expect(onRikki({ enabled: true, last_error_at: sitten(2) }, NYT)).toBe(true)
    expect(onRikki({ enabled: true, last_error_at: sitten(24 * 8) }, NYT)).toBe(false)
    expect(onRikki({ enabled: true, last_success_at: sitten(1), last_error_at: sitten(2) }, NYT)).toBe(false)
  })
})
