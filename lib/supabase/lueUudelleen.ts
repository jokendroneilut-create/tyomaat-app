/*
 * YKSI UUSINTAYRITYS LUKUKYSELYYN (D-246).
 *
 * Johannes 7.10.2026: `/today` kaatui "Application error" -ruutuun, ja
 * SIVUN PAIVITYS KORJASI SEN. Sama tunnus toimi samaan aikaan mobiililla.
 * Virhe ei siis ollut koodissa eika datassa vaan yhdessa kyselyssa, joka
 * epaonnistui kerran.
 *
 * MIKSI VIRHELAJIA EI TUNNISTETA. Ohimenevan ja pysyvan virheen
 * erottaminen viestin perusteella on arvaus, joka vanhenee heti kun
 * PostgREST muuttaa sanamuotoaan. Siksi uusinta tehdaan JOKAISESTA
 * virheesta: pysyva virhe maksaa yhden turhan kyselyn ja kaatuu silti,
 * ohimeneva korjaantuu. Halvempi vaihtoehto ei ole tarkempi.
 *
 * VAIN LUKUUN. Kirjoituksen uusiminen voi tuplata rivin, joten tata ei
 * kayteta insertiin, updateen eika deleteen.
 *
 * TAMA EI KORVAA VIRHERAJAA. Jos molemmat yritykset kaatuvat, virhe
 * heitetaan eteenpain ja `app/error.tsx` nayttaa sen suomeksi. Uusinta
 * poistaa valahdykset, ei katkoja.
 */

const ODOTUS_MS = 250

export type Lukutulos<T> = { data: T | null; error: { message: string } | null }

export async function lueUudelleen<T>(
  /* Kysely rakennetaan funktiossa: PostgREST-rakentajaa ei voi await'ata kahdesti. */
  rakenna: () => PromiseLike<Lukutulos<T>>,
  nimi: string
): Promise<Lukutulos<T>> {
  const ensimmainen = await rakenna()
  if (!ensimmainen.error) return ensimmainen

  await new Promise((r) => setTimeout(r, ODOTUS_MS))
  const toinen = await rakenna()

  /*
   * Lokiin jaa jalki molemmista tapauksista. Ilman tata onnistunut
   * uusinta olisi nakymaton, eika kukaan huomaisi jos niita alkaa tulla
   * sata paivassa — silloin vika on muualla kuin satunnaisuudessa.
   */
  if (toinen.error) {
    console.error(`[lueUudelleen] ${nimi}: molemmat yritykset kaatuivat`, toinen.error.message)
  } else {
    console.warn(`[lueUudelleen] ${nimi}: ensimmainen yritys kaatui, toinen onnistui`, ensimmainen.error.message)
  }

  return toinen
}
