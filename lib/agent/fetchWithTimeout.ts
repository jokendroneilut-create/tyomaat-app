/*
 * PYYNTÖKOHTAINEN AIKAKATKAISU.
 *
 * Aikabudjetti tarkistetaan silmukassa pyyntöjen VÄLISSÄ, joten se ei voi
 * keskeyttää yksittäistä jumiin jäänyttä pyyntöä. Ilman pyyntökohtaista
 * kattoa yksi hidas palvelin syö koko ajon.
 *
 * Mitattu 30.8.2026 CaseM-alustalta (kaupunkien päätösjärjestelmä):
 *
 *   tampere.cloudnc.fi     9,4 s · 10,5 s · 24,1 s
 *   jyvaskyla.cloudnc.fi  11,6 s
 *   rovaniemi.cloudnc.fi  ei vastannut 60 sekunnissa lainkaan
 *
 * Tampereen lähdeajo kesti mitattuna 120,4 sekuntia, josta HAKU oli
 * 120,4 s ja tuonti 0,0 s — lähde kaatui 90 sekunnin katkaisuun eikä
 * ehtinyt tuoda mitään. Vika ei ollut tuonnissa vaan yhdessä pyynnössä
 * joka ei palannut.
 *
 * Katto on 25 s: hitain onnistunut vastaus oli 24,1 s, joten normaali
 * hitaus mahtuu mutta jumi katkeaa.
 */

export const REQUEST_TIMEOUT_MS = 25 * 1000

export type FetchLike = (url: string, init?: any) => Promise<any>

/*
 * Palauttaa vastauksen tai heittää, jos pyyntö ei valmistu ajassa.
 * Kutsuja päättää mitä katkaisusta seuraa — tässä ei niellä virhettä,
 * jotta hidas palvelin ei jää huomaamatta.
 */
export async function fetchWithTimeout(
  url: string,
  init: any = {},
  { timeoutMs = REQUEST_TIMEOUT_MS, fetchImpl }: { timeoutMs?: number; fetchImpl?: FetchLike } = {}
): Promise<any> {
  const haku: FetchLike = fetchImpl ?? (globalThis.fetch as FetchLike)
  const ctrl = new AbortController()

  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    return await haku(url, { ...init, signal: ctrl.signal })
  } finally {
    /*
     * Ajastin on siivottava myös onnistuneessa haarassa, muuten prosessi
     * jää elämään katkaisun verran jokaisen pyynnön jälkeen.
     */
    clearTimeout(timer)
  }
}
