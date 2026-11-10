/*
 * HANKKEEN TYYPPI KORTILLE.
 *
 * Johannes 11.11.2026: *"tänään näkymässä olisi hyvä näyttää hanketyyppi.
 * esimerkiksi tuo fcdc ei suoraan kerro että kyseessä on datakeskus. Eikä
 * muutenkaan otsikko kerro aina mistä hankkeesta on kyse."*
 *
 * Nimi on lähteen oma, eikä lähde kirjoita sitä myyjälle: "FCDC Vaasa,
 * Kuriiritie", "Hyperco Kouvola-Koria, Fin Holdco 1". Tyyppi on kannassa
 * valmiina, se vain ei näkynyt missään.
 *
 * KOLME KENTTÄÄ, KOSKA NE TÄYTTYVÄT ERI LÄHTEISTÄ. `property_type` on
 * pääkenttä (mitattu 11.11.2026: 53 eri arvoa, täytetty 2 449/3 000 =
 * 82 % Tänään-syötteessä). Tyhjistä 101 saa arvon
 * `metadata.construction_type`-kentästä; `building_type` ei auta
 * yhdessäkään, mutta se jätetään ketjuun koska kerääjät kirjoittavat
 * siihen yhä ([[building-type-three-deciders]]).
 *
 * KAKSI SIIVOUSTA, molemmat mitattuja:
 *   - Alkukirjain vaihtelee: "Koulu" 177 riviä, "koulu" 12. Sama tyyppi
 *     näyttäisi kahdelta eri tyypiltä vierekkäisillä korteilla.
 *   - Pisin arvo on 79 merkkiä ("Metallimalmien ja muiden
 *     kaivoskivennäisten louhinta, rikastaminen ja käsittely"). Se
 *     rikkoisi kortin rivityksen, joten pitkä katkaistaan sanan rajalta.
 *
 * Tyhjä palauttaa nullin: merkkiä ei keksitä, vaan se jätetään pois.
 */

const NAYTON_MAX = 34

function siisti(arvo: unknown): string {
  return String(arvo ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * `maxPituus` on kortin rajoite, ei tiedon. Modaalissa on tilaa koko
 * arvolle, joten se antaa Infinityn — sama lähdeketju ja sama
 * alkukirjainsiivous, mutta ilman katkaisua.
 */
export function hankkeenTyyppi(
  project: any,
  maxPituus: number = NAYTON_MAX
): string | null {
  const raaka =
    siisti(project?.property_type) ||
    siisti(project?.metadata?.building_type) ||
    siisti(project?.metadata?.construction_type)

  if (!raaka) return null

  /*
   * Alkukirjain isoksi vain jos se on pieni kirjain. Arvo voi alkaa
   * numerolla ("2x110 ja 110 kilovoltin voimajohtojärjestelyt"), eikä
   * siihen pidä koskea.
   */
  const ekaIsolla =
    raaka[0] === raaka[0].toLowerCase() && raaka[0] !== raaka[0].toUpperCase()
      ? raaka[0].toUpperCase() + raaka.slice(1)
      : raaka

  if (ekaIsolla.length <= maxPituus) return ekaIsolla

  const katkaistu = ekaIsolla.slice(0, maxPituus)
  const valiPaikka = katkaistu.lastIndexOf(" ")

  /*
   * Sanan rajalta, mutta vain jos siitä jää luettava pätkä. Muuten
   * yhdestä pitkästä sanasta jäisi pelkkä kolme pistettä.
   */
  const paate =
    valiPaikka > maxPituus / 2 ? katkaistu.slice(0, valiPaikka) : katkaistu

  return paate.replace(/[\s,;:-]+$/, "") + "…"
}
