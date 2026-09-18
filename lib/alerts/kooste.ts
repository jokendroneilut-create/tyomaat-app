/*
 * HÄLYTYSKOOSTEEN KOKO JA JÄRJESTYS (D-193).
 *
 * Kun hälytys alkoi noudattaa käyttäjän valitsemia myyntihetkiä, määrä
 * kasvoi mitattuna 280 -> 928 kohdetta viikossa. Sähköposteja ei tule
 * enempää (yksi kooste päivässä), mutta laajasti valinneen käyttäjän
 * kooste pitenisi noin kymmeneen hankkeeseen päivässä.
 *
 * Aiemmin raja oli hiljaa 30 näytössä, mutta KAIKKI osumat kirjattiin
 * lähetetyiksi - myös ne joita viestissä ei näkynyt. Nyt näytetään
 * tärkeimmät kymmenen, loput mainitaan määränä, ja kirjataan vain
 * näytetyt. Loput näkyvät edelleen Tänään-näkymässä.
 *
 * Oma moduuli, koska Next.js ei salli route-tiedostosta muita nimettyjä
 * exportteja kuin HTTP-käsittelijät - ja nämä halutaan testata.
 */

export const KOOSTEESSA_ENINTAAN = 10

const ARVON_JARJESTYS: Record<string, number> = { high: 3, medium: 2, low: 1 }

/* Hankkeen arvo järjestystä varten: suuri hanke ensin. */
export function hankkeenArvo(project: any): number {
  return ARVON_JARJESTYS[String(project?.metadata?.business_value ?? "")] ?? 0
}

export function valitseKoosteeseen<T extends { rank: number }>(
  matches: T[]
): { naytettavat: T[]; muita: number } {
  /* Vakaa järjestys: saman arvon hankkeet säilyttävät keskinäisen järjestyksensä. */
  const jarjestetty = matches
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.rank - a.m.rank || a.i - b.i)
    .map(({ m }) => m)

  return {
    naytettavat: jarjestetty.slice(0, KOOSTEESSA_ENINTAAN),
    muita: Math.max(0, matches.length - KOOSTEESSA_ENINTAAN),
  }
}
