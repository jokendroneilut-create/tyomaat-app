import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/*
 * OHJAUSMERKIT LÄHDEKOODISSA.
 *
 * Sama vika osui kolmesti 29.8.2026: regexiin kirjoitettu sananraja
 * muuttui matkalla ASKELPALAUTINMERKIKSI (U+0008), jolloin kuvio vaati
 * tekstiltä merkin jota siinä ei koskaan ole — eli ei osunut mihinkään.
 *
 * Vika on erityisen ikävä koska se ei näy: editorissa rivi näyttää
 * oikealta, ja kolmas kerta löytyi vasta ajamalla poimijaa oikeaa dataa
 * vasten. Kahdella ensimmäisellä kerralla luvut näyttivät siihen asti
 * uskottavilta.
 *
 * Tämä testi lukee lähdetiedostot ja kaatuu jos niissä on
 * ohjausmerkkejä. Sarkain ja rivinvaihto ovat sallittuja.
 */

const JUURET = ["lib", "app", "scripts", "middleware.ts"]
const PAATTEET = [".ts", ".tsx"]

/*
 * Kaikki ohjausmerkit paitsi sarkain (U+0009), rivinvaihto (U+000A) ja
 * vaunupalautus (U+000D). Kirjoitettu escape-muodossa, jottei tämä
 * tiedosto itse laukaise sääntöä.
 */
const OHJAUSMERKIT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function tiedostot(polku: string): string[] {
  let tila
  try {
    tila = statSync(polku)
  } catch {
    return []
  }

  if (tila.isFile()) {
    return PAATTEET.some((p) => polku.endsWith(p)) ? [polku] : []
  }

  const ulos: string[] = []
  for (const nimi of readdirSync(polku)) {
    if (nimi === "node_modules" || nimi === ".next" || nimi.startsWith(".")) continue
    ulos.push(...tiedostot(join(polku, nimi)))
  }
  return ulos
}

describe("lahdekoodissa ei ole ohjausmerkkeja", () => {
  it("kaikki tiedostot ovat puhtaita", () => {
    const lika: string[] = []

    for (const juuri of JUURET) {
      for (const tiedosto of tiedostot(juuri)) {
        const sisalto = readFileSync(tiedosto, "utf8")
        if (!OHJAUSMERKIT.test(sisalto)) continue

        /* Rivinumero mukaan, jotta vika löytyy heti. */
        const rivi = sisalto.split("\n").findIndex((r) => OHJAUSMERKIT.test(r))
        lika.push(`${tiedosto}:${rivi + 1}`)
      }
    }

    expect(lika).toEqual([])
  })
})
