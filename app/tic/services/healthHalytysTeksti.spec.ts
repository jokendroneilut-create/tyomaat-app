import { describe, expect, it, beforeAll } from "vitest"

import type { HealthAlert } from "./getHealthAlertCount"

/*
 * Palvelu luo Supabase-asiakkaan moduulitasolla, joten ympäristömuuttujat
 * on asetettava ennen importia. Itse testattava funktio on puhdas.
 */
let kuvaaHealthHalytys: (alert: HealthAlert) => string

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://testi.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "testiavain"
  ;({ kuvaaHealthHalytys } = await import("./getHealthAlertCount"))
})

function halytys(rikkiLahteita: number, putkenVirheita: number): HealthAlert {
  return {
    rikkiLahteita,
    putkenVirheita,
    rikkinaiset: [],
    yhteensa: rikkiLahteita + putkenVirheita,
  }
}

/*
 * Sivupalkin merkki ja Health-sivun otsikko lukevat tämän saman funktion.
 * Testi ei siis varmista vain sanamuotoa vaan sen, että lause ylipäänsä on
 * olemassa yhdessä paikassa - kaksi kopiota oli juuri se vika joka
 * `lahteenTila`-säännössä ehti syntyä (D-185).
 */
describe("kuvaaHealthHalytys", () => {
  it("kertoo kun mitään ei ole vialla", () => {
    expect(kuvaaHealthHalytys(halytys(0, 0))).toBe("Ei havaittuja ongelmia")
  })

  it("taivuttaa yhden lähteen yksikköön", () => {
    /* "1 lähdettä rikki" oli se luettavuusvirhe joka esti luvun näyttämisen. */
    expect(kuvaaHealthHalytys(halytys(1, 0))).toBe(
      "1 lähde rikki (viimeisin ajo kaatui, alle viikko sitten)"
    )
  })

  it("käyttää monikkoa useammasta lähteestä", () => {
    expect(kuvaaHealthHalytys(halytys(3, 0))).toBe(
      "3 lähdettä rikki (viimeisin ajo kaatui, alle viikko sitten)"
    )
  })

  it("kertoo putken kaatumiset erikseen", () => {
    expect(kuvaaHealthHalytys(halytys(0, 1))).toBe("1 putken kaatuminen 24 h")
    expect(kuvaaHealthHalytys(halytys(0, 4))).toBe("4 putken kaatumista 24 h")
  })

  it("erittelee molemmat syyt kun niitä on kaksi", () => {
    expect(kuvaaHealthHalytys(halytys(2, 5))).toBe(
      "2 lähdettä rikki (viimeisin ajo kaatui, alle viikko sitten), " +
        "5 putken kaatumista 24 h"
    )
  })
})
