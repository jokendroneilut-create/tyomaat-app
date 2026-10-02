/*
 * KUINKA VANHA YRITYSTIEDOTE VIELA KELPAA (D-226).
 *
 * Luku oli kopioituna 16 keraimeen (`getMonth() - 24`), eli sen
 * muuttaminen vaati kuudentoista tiedoston muokkaamisen ja yhdenkin
 * unohtaminen olisi jaanyt huomaamatta. Nyt se on yhdessa paikassa.
 *
 * KYNNYS MITATTIIN, EI ARVATTU (2.10.2026,
 * `scripts/measure-tiedotteiden-ika.ts`). Yrityslahteiden 678
 * ehdokkaasta luettiin tiedotteen paiva raakatekstista ja verrattiin
 * lopputulokseen:
 *
 *     alle 12 kk   267 ehdokasta, 32 hyvaksyttya   12 %
 *     yli 12 kk    263 ehdokasta,  8 hyvaksyttya    3 %
 *
 * Yli vuoden vanhoista 250 hylattiin 263:sta. Hyvaksymisaste on
 * nelinkertainen tuoreiden hyvaksi, joten raja on 12 kuukautta.
 *
 * HINTA ON TIEDOSSA EIKA NOLLA: kahdeksan hyvaksyttya hanketta olisi
 * jaanyt tulematta. Se on tietoinen vaihtokauppa 255 turhaa jonoriviä
 * vastaan, ei sivuvaikutus.
 *
 * TAMA KOSKEE VAIN TIEDOTELAHTEITA. Paatos- ja kaavalahteilla on omat
 * ikkunansa omista syistaan (CaseM ja Dynasty 18 kk, Helsingin
 * paatokset 3 kk, Savonlinna 15 kk) — niita tama ei kosketa.
 */
export const YRITYSTIEDOTTEEN_IKKUNA_KK = 12

/* Vanhin hyvaksyttava julkaisupaiva juuri nyt. */
export function tiedotteenAikaraja(nyt: Date = new Date()): Date {
  const raja = new Date(nyt)
  raja.setMonth(raja.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)
  return raja
}
