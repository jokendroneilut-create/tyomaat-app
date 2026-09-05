/*
 * EHTIIKÖ EHDOKAS VIELÄ TUOTAVAKSI?
 *
 * Ajolla on kaksi rajaa: tuonnin oma aikabudjetti ja koko ajon kova
 * katkaisu (90 s). Budjetti tarkistetaan ennen työtä eikä kesken sen,
 * koska keskeytetty tuonti jättäisi rivin puolitiehen — mutta pelkkä
 * "onko määräaika ohi" ei riitä. Kuusi ehdokasta voi käynnistyä juuri
 * ennen määräaikaa, ja jokainen niistä vie oman aikansa, joten ajo
 * ylittää katkaisun vaikka budjetti pysyi.
 *
 * Mitattu 5.9.2026 (Hartela): haku 8 s ja täydennys 5 s, mutta ajot
 * kestivät 69–93 s ja kaksi yhdeksästä kaatui katkaisuun. Häntä oli siis
 * parikymmentä sekuntia.
 *
 * ARVIO OTETAAN TÄSTÄ AJOSTA, EI VAKIOSTA. Lähteet ovat erilaisia ja
 * ehdokkaan tuontikustannus muuttuu (relevanssiportti ja kohdetyypitin
 * ovat kumpikin mallikutsu), joten kiinteä luku vanhenisi. Ensimmäiset
 * ehdokkaat aloitetaan aina, jotta arviolle saadaan pohja.
 */

/* Montako ehdokasta mitataan ennen kuin arvioon luotetaan. */
export const POHJA_OTOS = 3

export function ehtiiViela(input: {
  nyt: number
  maaraaika: number
  /* Valmistuneita ehdokkaita tässä ajossa (myös epäonnistuneet). */
  valmiita: number
  /* Niihin kulunut aika yhteensä, ms. */
  kaytettyMs: number
  /* Montako ehdokasta ajetaan rinnakkain. */
  rinnakkaisuus: number
}): boolean {
  /*
   * Ilman pohjaa mennään vanhalla säännöllä: aloitetaan jos määräaikaa
   * on jäljellä. Muuten ensimmäinen ehdokas ei koskaan lähtisi liikkeelle
   * eikä arviota syntyisi.
   */
  if (input.valmiita < POHJA_OTOS) {
    return input.nyt <= input.maaraaika
  }

  const keskiarvo = input.kaytettyMs / input.valmiita

  /*
   * Varaus on yhden ehdokkaan keskikesto kerrottuna rinnakkaisuudella:
   * pahin tapaus on että kaikki rinnakkaiset paikat täyttyvät juuri nyt
   * ja jokainen vie keskimääräisen ajan.
   */
  const varaus = keskiarvo * Math.max(1, input.rinnakkaisuus)

  return input.nyt + varaus <= input.maaraaika
}
