/*
 * OSOITTEET JOIHIN EI KOHDISTETA PYYNTÖJÄ.
 *
 * Neljä kaupunkia on kieltänyt päätösjärjestelmänsä koneellisen haun
 * kirjallisesti, ja jokaiselle on annettu kirjallinen lupaus siitä että
 * emme hae. Lupaus on tähän asti ollut vain dokumentissa ja yksittäisen
 * skriptin sisäisenä listana — nyt se on yhdessä paikassa ja koodi
 * pitää siitä kiinni.
 *
 *   Hyvinkää   asianhallintavhp.hyvinkaa.fi   (Tweb)    D-098, 21.8.2026
 *   Vantaa     päätösjärjestelmä              (Tweb)    D-098, 24.8.2026
 *   Lappeenranta mfiles.lappeenranta.fi       (M-Files) D-149, 30.8.2026
 *   Oulu       asiakirjat.ouka.fi             (LOOTA)   D-160,  1.9.2026
 *
 * Kaksi tarkennusta, jotka on helppo ymmärtää väärin:
 *
 * 1. KIELTO KOSKEE PÄÄTÖSJÄRJESTELMÄÄ, EI KAUPUNKIA. Lappeenrannan
 *    kaavoitussivu (www.lappeenranta.fi) on eri järjestelmä ja eri asia;
 *    se on käytössä eikä sitä kielletty. Siksi säännöt osuvat
 *    isäntänimeen, eivät kaupungin nimeen.
 *
 * 2. HYVINKÄÄN RSS-SYÖTE ON POIKKEUS. Kaupunki suositteli sitä itse
 *    kirjallisesti kahdesti, joten syötteen lukeminen on sallittua —
 *    mutta vain syötteen, ei sen linkkien takana olevien asiakirjojen.
 *    Sitä ei sallita tässä automaattisesti: syöte on haettava tietoisesti
 *    `salliRssSyote`-lipulla, jottei koko isäntä avaudu vahingossa.
 */

export type KiellettyLahde = {
  /* Isäntänimen osa, pienellä. */ tunniste: string
  kaupunki: string
  jarjestelma: string
  paatos: string
  /* Syötteen polku, jos kaupunki on nimenomaan suositellut sitä. */
  sallittuSyote?: string
}

export const KIELLETYT_LAHTEET: KiellettyLahde[] = [
  {
    tunniste: "asianhallintavhp.hyvinkaa.fi",
    kaupunki: "Hyvinkää",
    jarjestelma: "Tweb",
    paatos: "D-098 (21.8.2026)",
    sallittuSyote: "/ktwebscr/",
  },
  {
    tunniste: "tweb.fi",
    kaupunki: "Tweb-kunnat",
    jarjestelma: "Tweb",
    paatos: "D-098 (21.8.2026)",
  },
  {
    tunniste: "asianhallinta.vantaa.fi",
    kaupunki: "Vantaa",
    jarjestelma: "Tweb",
    paatos: "D-098 (24.8.2026)",
  },
  {
    tunniste: "mfiles.lappeenranta.fi",
    kaupunki: "Lappeenranta",
    jarjestelma: "M-Files",
    paatos: "D-149 (30.8.2026)",
  },
  /*
   * Oulun kielto koskee päätösten julkaisusivua ja sen takana olevaa
   * asianhallintaa. Kaavoitussivu www.ouka.fi on eri järjestelmä ja
   * käytössä normaalisti — sitä ei kielletty.
   *
   * RSS-syötettä EI merkitä sallituksi. Kaupunki kertoi sen olemassa
   * olosta mutta ei antanut sille lupaa: kirje päättyy lauseeseen "Oulun
   * kaupunki ei anna lupaa päätösten hakemiseen suoraan järjestelmästä",
   * ja syöte on kirjeen mukaan osa samaa valmisjärjestelmää. Lupa
   * kysytään erikseen ennen kuin syötettä luetaan.
   */
  {
    tunniste: "asiakirjat.ouka.fi",
    kaupunki: "Oulu",
    jarjestelma: "LOOTA",
    paatos: "D-160 (1.9.2026)",
  },
]

function isanta(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    /* Ei kelvollinen osoite: verrataan koko merkkijonoon, ei päästetä läpi. */
    return String(url ?? "").toLowerCase()
  }
}

/*
 * Palauttaa kiellon jos osoitteeseen ei saa tehdä pyyntöä, muuten null.
 *
 * `salliRssSyote` päästää läpi vain sen polun jonka kaupunki on itse
 * suositellut, ei muuta samalta isännältä.
 */
export function kiellettyOsoite(
  url: string,
  { salliRssSyote = false }: { salliRssSyote?: boolean } = {}
): KiellettyLahde | null {
  const host = isanta(url)

  for (const lahde of KIELLETYT_LAHTEET) {
    const osuu = host === lahde.tunniste || host.endsWith(`.${lahde.tunniste}`) || host.includes(lahde.tunniste)
    if (!osuu) continue

    if (salliRssSyote && lahde.sallittuSyote && String(url).includes(lahde.sallittuSyote)) {
      return null
    }

    return lahde
  }

  return null
}

export function kiellonSelitys(lahde: KiellettyLahde): string {
  return `${lahde.kaupunki} on kieltänyt koneellisen haun (${lahde.jarjestelma}, ${lahde.paatos}). Osoitteeseen ei tehdä pyyntöjä.`
}
