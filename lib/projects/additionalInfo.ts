/*
 * LISÄTIETOTEKSTIN PÄIVITYS YHDISTETTÄESSÄ.
 *
 * Yhdistäminen täytti vain tyhjiä kenttiä, eikä `additional_info` ollut
 * edes päivityslistalla. Siitä seurasi että hankkeen lisätiedot jäivät
 * ensimmäisen lähteen varaan ikuisiksi ajoiksi.
 *
 * Mitattu tapaus 22.8.2026, Kouvolan yhtenäiskoulu: hanke on vaiheessa
 * "Rakenteilla" ja rakentaminen alkoi 19.2.2026, mutta lisätiedoissa luki
 * yhä *"Rakentamisen on tavoitteena käynnistyä keväällä 2026"* — vanhan
 * tiedotteen lupaus.
 *
 * MIKSI KORVATAAN EIKÄ LIITETÄ PERÄÄN. Kaksi saman hankkeen tiedotetta
 * toistaa tyypillisesti 60–80 % sisällöstä ja voi olla kumpikin 4 000
 * merkkiä. Perään liitettynä kenttään jäisi sekä vanha lupaus että uusi
 * tosiasia, eikä lukija tietäisi kumpi pätee. Ristiriitainen teksti on
 * huonompi kuin vanhentunut.
 *
 * YHTEYSTIEDOT EIVÄT SAA KADOTA. Ne ovat yksi kolmesta syystä joiden takia
 * testiasiakkaat eivät jääneet maksaviksi, ja käyttäjä on voinut lisätä
 * niitä käsin juuri tähän kenttään. Siksi kutsujan on poimittava vanhan
 * tekstin yhteyshenkilöt `contact_persons`-kenttään ENNEN korvaamista —
 * ks. approve-reitin yhdistämishaara.
 */

/*
 * Uusi teksti ei saa olla merkittävästi lyhyempi. Tiedotteista osa on
 * lyhyitä nostoja, ja niillä korvaaminen hävittäisi pitkän kuvauksen
 * yksityiskohdat. Raja on väljä: tarkoitus on estää romahdus, ei vaatia
 * yhtä pitkää tekstiä.
 */
const MIN_RATIO = 0.4

export function chooseAdditionalInfo(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const vanha = String(existing ?? "").trim()
  const uusi = String(incoming ?? "").trim()

  if (!uusi) return vanha || null
  if (!vanha) return uusi

  /* Sama teksti — ei syytä kirjoittaa. */
  if (uusi === vanha) return vanha

  if (uusi.length < vanha.length * MIN_RATIO) return vanha

  return uusi
}
