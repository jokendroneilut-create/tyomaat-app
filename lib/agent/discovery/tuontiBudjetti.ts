/*
 * EHTIIKÖ EHDOKAS VIELÄ TUOTAVAKSI?
 *
 * Ajolla on kaksi rajaa: tuonnin oma aikabudjetti ja koko ajon kova
 * katkaisu (90 s). Budjetti tarkistetaan ennen työtä eikä kesken sen,
 * koska keskeytetty tuonti jättäisi rivin puolitiehen — mutta pelkkä
 * "onko määräaika ohi" ei riitä. Ehdokas voi käynnistyä juuri ennen
 * määräaikaa ja viedä oman aikansa, jolloin ajo ylittää katkaisun
 * vaikka budjetti pysyi.
 *
 * Mitattu 5.9.2026 (Hartela): haku 8 s ja täydennys 5 s, mutta ajot
 * kestivät 69–93 s ja kaksi yhdeksästä kaatui katkaisuun. Häntä oli siis
 * parikymmentä sekuntia — eli suunnilleen YHDEN ehdokkaan verran.
 *
 * ARVIO OTETAAN TÄSTÄ AJOSTA, EI VAKIOSTA. Lähteet ovat erilaisia ja
 * ehdokkaan tuontikustannus muuttuu (relevanssiportti ja kohdetyypitin
 * ovat kumpikin mallikutsu), joten kiinteä luku vanhenisi. Ensimmäiset
 * ehdokkaat aloitetaan aina, jotta arviolle saadaan pohja.
 *
 * VARAUS ON YHDEN EHDOKKAAN KESTO, EI RINNAKKAISUUDELLA KERROTTU
 * (D-210). Varaus oli aiemmin `keskiarvo × rinnakkaisuus` sillä
 * perusteella, että pahimmassa tapauksessa kaikki rinnakkaiset paikat
 * täyttyvät juuri nyt. Päättely on väärä: rinnakkaiset ehdokkaat
 * kuluttavat saman seinäkellon, eivät peräkkäistä. Vapautuvaan paikkaan
 * aloitettu ehdokas päättyy hetkessä `nyt + keskiarvo`, eikä muiden jo
 * käynnissä olevien kesto ala siitä uudelleen.
 *
 * Virheen hinta mitattiin 24.9.2026. Kertoimella 6 ja 70 sekunnin
 * budjetilla varaus ylittää koko budjetin heti kun ehdokas maksaa yli
 * ~12 s, jolloin ajo tuo tasan `CANDIDATE_CONCURRENCY` ehdokasta eikä
 * yhtään enempää — ensimmäiset kuusi ehtivät käynnistyä ennen kuin pohja
 * on mitattu. STT-tiedotteissa niin kävi kolmessa ajossa neljästä:
 * 20.9. ajossa syntyi 26 uutta dokumenttia ja 6 tuontia, ja
 * hakurajapinnan 110 kandidaatista 97 oli sellaisia joita ei ollut
 * koskaan tuotu.
 */

/* Montako ehdokasta mitataan ennen kuin arvioon luotetaan. */
export const POHJA_OTOS = 3

/*
 * Varmuuskerroin keskiarvon päälle: yksittäinen ehdokas voi kestää
 * keskimääräistä kauemmin (hidas sivuhaku, mallikutsun uusinta).
 * Budjetin (70 s) ja kovan katkaisun (90 s) väliin jää 20 s, joten
 * ylitys mahtuu marginaaliin silloinkin kun arvio menee pieleen.
 */
export const TURVAKERROIN = 1.5

export function ehtiiViela(input: {
  nyt: number
  maaraaika: number
  /* Valmistuneita ehdokkaita tässä ajossa (myös epäonnistuneet). */
  valmiita: number
  /* Niihin kulunut aika yhteensä, ms. */
  kaytettyMs: number
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

  return input.nyt + keskiarvo * TURVAKERROIN <= input.maaraaika
}
