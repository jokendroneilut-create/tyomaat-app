/*
 * SOPIMUSKAUSI ON JO PÄÄTTYNYT (D-438).
 *
 * Hilman jälki-ilmoitus julkaistaan usein kuukausia urakan jälkeen.
 * Maatullinpuiston massastabiloinnin sopimuskausi oli 29.5.–20.7.2026,
 * mutta ilmoitus tuli 18.11.2026 ja meni jonoon uutena hankkeena.
 * Mitattu 19.11.2026: 30 vuorokauden aikana 9/122 jonoon tulleesta
 * jälki-ilmoituksesta oli jo päättynyt.
 *
 * Johanneksen päätös: ei karsita, vaan näytetään katselmoijalle varoitus.
 * Päivä luetaan `metadata.hilma_sopimuskausi.loppu`-kentästä
 * (`lib/agent/hilmaSopimuskausi.ts`). Kenttä täytetään myös silloin, kun
 * aloituspäivä hylätään (`kelpasi: false`, esim. puitesopimus), joten
 * loppu on käytettävissä riippumatta siitä.
 *
 * Tuntematon loppu ei laukaise mitään ([[never-hide-on-missing-data]]).
 */

export type PaattynytSopimuskausi = {
  alku: string | null
  loppu: string
  /** Päättyikö kausi jo ennen kuin ilmoitus julkaistiin (työ tehty ennen kuin kuulimme). */
  ennenJulkaisua: boolean
}

const PAIVA = /^\d{4}-\d{2}-\d{2}/

export function sopimuskausiPaattynyt(
  metadata: Record<string, any> | null | undefined,
  nyt: Date = new Date()
): PaattynytSopimuskausi | null {
  const kausi = metadata?.hilma_sopimuskausi
  const loppu = typeof kausi?.loppu === "string" && PAIVA.test(kausi.loppu) ? kausi.loppu.slice(0, 10) : null
  if (!loppu) return null

  const tanaan = nyt.toISOString().slice(0, 10)
  if (loppu >= tanaan) return null

  const julkaistu = typeof metadata?.date_published === "string" ? metadata.date_published.slice(0, 10) : null
  const alku = typeof kausi?.alku === "string" && PAIVA.test(kausi.alku) ? kausi.alku.slice(0, 10) : null
  return { alku, loppu, ennenJulkaisua: !!julkaistu && loppu < julkaistu }
}

export function suomeksi(paiva: string): string {
  const [v, k, p] = paiva.split("-")
  return `${Number(p)}.${Number(k)}.${v}`
}
