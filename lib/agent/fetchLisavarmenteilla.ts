import https from "node:https"
import tls from "node:tls"

import { LE_YE_KETJU } from "./lisavarmenteet"

/*
 * HAKU PALVELIMELTA JOLTA PUUTTUU VÄLIVARMENNE (D-185).
 *
 * Noden `fetch` ei ota lisävarmenteita vastaan, joten haku tehdään
 * `node:https`-moduulilla ja palautetaan tavallisena `Response`-oliona:
 * kutsukohta pysyy muuten ennallaan.
 *
 * Luotetut juuret ovat Noden omat, ja niiden jatkoksi annetaan Let's
 * Encryptin YE-välivarmenteet. Allekirjoitukset tarkistetaan normaalisti;
 * mitään ei ohiteta. Käytä vain lähteille joiden palvelin on todennetusti
 * jättänyt välivarmenteen lähettämättä.
 */

const CA = [...tls.rootCertificates, ...LE_YE_KETJU]

/*
 * Aikaraja pyynnölle. Lähteen koko ajon katto on 90 s
 * (`sourceWorker.SOURCE_TIMEOUT_MS`), joten yksi jumittava pyyntö ei saa
 * syödä sitä kokonaan.
 */
const AIKARAJA_MS = 20_000
const UUDELLEENOHJAUKSIA = 3

/* Näillä tiloilla Response ei saa sisältää runkoa. */
const TYHJAT_TILAT = new Set([204, 205, 304])

export function fetchLisavarmenteilla(
  url: string,
  init: { headers?: Record<string, string> } = {},
  ohjauksia = 0
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const pyynto = https.get(url, { ca: CA, headers: init.headers, timeout: AIKARAJA_MS }, (vastaus) => {
      const tila = vastaus.statusCode ?? 0
      const kohde = vastaus.headers.location

      if (tila >= 300 && tila < 400 && kohde && ohjauksia < UUDELLEENOHJAUKSIA) {
        vastaus.resume()
        resolve(fetchLisavarmenteilla(new URL(kohde, url).toString(), init, ohjauksia + 1))
        return
      }

      const palat: Buffer[] = []
      vastaus.on("data", (pala: Buffer) => palat.push(pala))
      vastaus.on("error", reject)
      vastaus.on("end", () => {
        resolve(
          new Response(TYHJAT_TILAT.has(tila) ? null : Buffer.concat(palat), {
            status: tila,
          })
        )
      })
    })

    pyynto.on("timeout", () => pyynto.destroy(new Error(`Aikaraja ${AIKARAJA_MS} ms: ${url}`)))
    pyynto.on("error", reject)
  })
}
