/*
 * "NÄYTÄ LISÄÄ" -ERÄN LASKENTA.
 *
 * Omana funktionaan, koska se on ainoa osa nappia jossa voi olla vika:
 * montako riviä näkyy, montako on vielä ladattuna piilossa ja montako
 * jäi lataamatta kokonaan. Komponentti itse on vain HTML:ää, ja sitä ei
 * voi testata ilman kirjautunutta istuntoa.
 *
 * Kolme lukua ovat eri asioita:
 *   nakyvat    = tällä hetkellä renderöidyt rivit
 *   jaljella   = ladattuja rivejä jotka nappi voi vielä paljastaa
 *   lataamatta = pisteytettyjä joita palvelin ei lähettänyt lainkaan
 *
 * Viimeinen on syy siihen miksi napin tilalle tulee lopuksi linkki koko
 * hankelistaukseen: syötteeseen ladataan sata riviä, mutta käyttäjän
 * alueella voi olla tuhat.
 */
export function eraNakyma<T>(input: {
  /* Palvelimen lähettämät rivit, piilotetut jo suodatettuina pois. */
  rivit: T[]
  /* Montako näytetään juuri nyt. */
  nakyvissa: number
  /* Kaikki pisteytetyt, myös lataamatta jääneet. */
  kaikkiPisteytetyt?: number
}): { nakyvat: T[]; jaljella: number; lataamatta: number } {
  const raja = Math.max(0, Math.floor(input.nakyvissa))
  const nakyvat = input.rivit.slice(0, raja)

  return {
    nakyvat,
    jaljella: input.rivit.length - nakyvat.length,
    lataamatta: Math.max(0, (input.kaikkiPisteytetyt ?? input.rivit.length) - input.rivit.length),
  }
}
