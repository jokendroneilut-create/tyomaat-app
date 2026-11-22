import https from "node:https"

/*
 * TURUN KAAVASIVUN OSOITE JA HAKU (22.11.2026, D-449).
 *
 * Johannes 22.11.2026 jonorivistä "VI 006-23-3., -8., -1002., -2002, os.
 * Tuureporinkatu 6b-12": *"miksi tämä lähde ei näytä mitään? Turusta on
 * tullut vastaavia joskus ennenkin"*.
 *
 * 1. OSOITTEESSA VÄLILYÖNTI. Turun WFS antaa kaavasivun osoitteen käsin
 *    kirjoitettuna: ".../kaavoitus/tuureporinkatu 6b-12-3858-2022" (404),
 *    oikea on ".../tuureporinkatu-6b-12-3858-2022" (200). Samoin
 *    ".../kaavoitus/ vilhonkatu12a-…" (väli kauttaviivan jälkeen). D-336
 *    tunsi nämä vain "kuolleina osoitteina".
 *
 * 2. fetch() JÄÄ JUMIIN www.turku.fi:hin. Mitattu 22.11.2026: undici-
 *    pohjainen fetch aikakatkesi 15 s:n jälkeen jokaisella User-Agentilla
 *    ja myös IPv4:llä, kun Noden https-moduuli ja curl saivat vastauksen
 *    alle 0,13 s:ssa (Fastly). Sivu myös ohjautuu aina 301:llä
 *    (/kaavoitus/x -> /rakentaminen/kaavoitus/x), joten haun on seurattava
 *    ohjausta. Sama ilmiö kuin Valkeakoskella (fetchTextViaHttpsModule).
 */

/* Polun osat ilman reunavälejä, sisävälit väliviivoiksi. Isäntää ei muuteta. */
export function turunKaavasivunOsoite(planUrl: string | null | undefined): string | null {
  const raaka = String(planUrl ?? "").trim()
  if (!raaka) return null
  const m = raaka.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
  if (!m) return raaka
  const polku = (m[2] ?? "")
    .split("/")
    .map((osa) => osa.trim().replace(/\s+/g, "-"))
    .join("/")
  return `${m[1]}${polku}`
}

const AIKARAJA_MS = 15_000
const MAX_OHJAUKSET = 5

export function haeTurunSivu(
  url: string,
  ohjauksia = 0
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve) => {
    const pyynto = https.get(url, { timeout: AIKARAJA_MS }, (vastaus) => {
      const status = vastaus.statusCode ?? 0
      const kohde = vastaus.headers.location
      if (status >= 300 && status < 400 && kohde && ohjauksia < MAX_OHJAUKSET) {
        vastaus.resume()
        resolve(haeTurunSivu(new URL(kohde, url).toString(), ohjauksia + 1))
        return
      }
      const palat: Buffer[] = []
      vastaus.on("data", (pala) => palat.push(pala))
      vastaus.on("end", () =>
        resolve({ ok: status >= 200 && status < 300, status, text: Buffer.concat(palat).toString("utf-8") })
      )
      vastaus.on("error", () => resolve({ ok: false, status, text: "" }))
    })
    pyynto.on("timeout", () => {
      pyynto.destroy()
      resolve({ ok: false, status: 0, text: "" })
    })
    pyynto.on("error", () => resolve({ ok: false, status: 0, text: "" }))
  })
}

/*
 * KAUPUNGINOSA JA OSOITE KAAVAN NIMESTÄ.
 *
 * Nimi on muotoa "{kaupunginosa} {kiinteistötunnus}, os. {osoite}"
 * ("Perno 065-40-3, os. Heinikonkatu 2"). Osoitteeksi otettiin toinen
 * pilkulla erotettu osa, mutta kiinteistöluettelossa on pilkkuja:
 * "VI 006-23-3., -8., -1002., -2002, os. Tuureporinkatu 6b-12" antoi
 * osoitteeksi "-8." (D-449). "os." voittaa nyt, ja ilman sitä toinen osa
 * kelpaa vain jos siinä on sana.
 */
export function turunKaupunginosaJaOsoite(kaavanNimi: string | null): {
  district: string | null
  address: string | null
} {
  if (!kaavanNimi) return { district: null, address: null }

  const [left, right] = kaavanNimi.split(",").map((part) => part.trim())
  const osMerkinta = kaavanNimi.match(/(?:^|[\s,])os\.\s*(.+)$/i)?.[1]?.trim() || null
  const toinenOsa = right ? right.replace(/^os\.\s*/i, "").trim() || null : null
  const address = osMerkinta ?? (toinenOsa && /\p{L}{3,}/u.test(toinenOsa) ? toinenOsa : null)
  const district = left?.match(/^([A-ZÅÄÖa-zåäö]+(?:\s[A-ZÅÄÖa-zåäö]+)*)/)?.[1]?.trim() ?? null

  return { district, address }
}
