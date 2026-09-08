/*
 * KAHDEN PISTEEN ETÄISYYS JA SOLUTUS DUPLIKAATTIHAKUA VARTEN.
 *
 * `calculateMatch` ei katso koordinaatteja lainkaan, vaikka ne ovat
 * hankkeen tarkin sijaintitieto. Mitattu 8.9.2026 käyttäjän löytämästä
 * parista:
 *
 *   Kerrostalo Pohjoinen Liipolankatu 14        60.9645711, 25.66597
 *   Hartela toteuttaa asuinkerrostalon ...      60.9645712, 25.66597
 *
 * Yksitoista senttimetriä toisistaan, sama kaupunki ja sama
 * rakennusliike — ja täsmäytys palautti nullin, koska otsikot,
 * osoitekirjoitusasu ja rakennuttaja erosivat.
 */

export type Piste = { lat: number; lon: number }

const MAAPALLON_SADE_M = 6_371_000

/*
 * Haversine. Suomen mittakaavassa tasokin riittäisi, mutta ero on
 * muutama rivi eikä tätä ajeta miljoonia kertoja per pari — ryhmittely
 * karsii vertailut ensin.
 */
export function etaisyysMetreina(a: Piste, b: Piste): number {
  const rad = (x: number) => (x * Math.PI) / 180

  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2

  return 2 * MAAPALLON_SADE_M * Math.asin(Math.min(1, Math.sqrt(s)))
}

/*
 * SOLU ON KARKEAMPI KUIN RAJA, JA SE ON TARKOITUS.
 *
 * Kolme desimaalia on noin 100 m leveä solu, kun raja on 50 m. Solu on
 * vain esikarsinta: se tuo vertailtavaksi liikaa eikä liian vähän.
 * Naapurisolut on silti käytävä läpi, koska kaksi 10 metrin päässä
 * olevaa pistettä voi osua solurajan eri puolille.
 */
export function solu(piste: Piste): string {
  return `${piste.lat.toFixed(3)},${piste.lon.toFixed(3)}`
}

/*
 * Naapurit lasketaan PYÖRISTETYSTÄ pohjasta eikä raakaluvusta:
 * `(lat + 0.001).toFixed(3)` tuotti liukuluvun takia toisinaan saman
 * merkkijonon kahdelle eri siirrolle, jolloin ruudukkoon jäi reikiä.
 */
export function naapurisolut(piste: Piste): string[] {
  const lat = Math.round(piste.lat * 1000)
  const lon = Math.round(piste.lon * 1000)

  const solut: string[] = []
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      solut.push(`${((lat + dLat) / 1000).toFixed(3)},${((lon + dLon) / 1000).toFixed(3)}`)
    }
  }

  return solut
}
