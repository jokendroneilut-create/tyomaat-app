/*
 * KOHDETYYPIN VALIKON SAANNOT — YHTEISET SIVULLE JA HAKUVAHDILLE.
 *
 * Kohdetyyppi on vapaa tekstikentta, ei luettelo. Asiakas (Firesafe,
 * 13.10.2026) huomautti aiheellisesti, ettei kohdetyypilla voi hakea jos
 * ei tieda mita tyyppeja on olemassa. Valikko lasketaan siksi suoraan
 * aineistosta.
 *
 * Vapaa kentta tuo kaksi ansaa, ja molemmat on hoidettava TASSA eika
 * kahdessa paikassa, koska sivun suodatin ja hakuvahdin digest tekevat
 * saman rajauksen eri koodissa:
 *
 *  1. KIRJOITUSASU. Kannassa on "Koulu" 296 ja "koulu" 8, "Kerrostalo"
 *     618 ja "kerrostalo" 4. Kaksi riviä valikossa on käyttäjälle virhe,
 *     ei tieto. Rivit yhdistetaan, ja yleisin kirjoitusasu on nimilappu.
 *     Kantaa ei siivota: sama hanke voi tulla lahteesta uudelleen
 *     pienella alkukirjaimella, joten yhdistaminen kuuluu lukuhetkeen.
 *
 *  2. TYYPITTOMAT. 37 % nakyvista hankkeista on ilman tyyppia (mitattu
 *     13.10.2026: 2 377 / 6 497), ja niista 86 % on kaavalahteista —
 *     kaavahanke ei ole rakennus, joten tyhja kentta on niissa osin
 *     rehellinen. Ne ovat omana rivinaan eivatka katoa hiljaa (D-274:
 *     jos emme tieda, naytamme). Nimilappu "Ei tyyppia" on kuitenkin
 *     vain kayttoliittyman teksti — kannassa arvo on NULL. Hakuvahtiin
 *     se on siksi kirjoitettava tunnisteena, jonka /api/digests kaantaa
 *     `is null` -ehdoksi. Ilman tata tallennettu haku antaisi aina nolla
 *     osumaa.
 */

/** Nimilappu kayttoliittymassa. Kannassa arvo on NULL. */
export const TYYPPI_PUUTTUU = "Ei tyyppiä"

/** Tunniste hakuvahdin suodattimessa; /api/digests kaantaa `is null`. */
export const TYYPPI_PUUTTUU_AVAIN = "__ei_tyyppia__"

export type KohdetyypinLuku = {
  /** Yleisin kirjoitusasu, nayteaan valikossa. */
  nimi: string
  lkm: number
  /** Kaikki kirjoitusasut jotka taman nimen alle laskettiin. */
  kirjoitusasut: string[]
}

type Rivi = { property_type?: string | null }

function avain(tyyppi: string): string {
  return tyyppi.trim().toLowerCase()
}

/*
 * Valikon rivit suurimmasta pienimpaan. Tyypittomat viimeiseksi vaikka
 * ne ovat suurin joukko: se ei ole tyyppi vaan puute, eika sen kuulu
 * johtaa listaa.
 */
export function laskeKohdetyypit(rivit: Rivi[]): KohdetyypinLuku[] {
  const ryhmat = new Map<string, Map<string, number>>()

  for (const rivi of rivit) {
    const raaka = (rivi.property_type ?? "").trim()
    const avainsana = raaka ? avain(raaka) : TYYPPI_PUUTTUU_AVAIN
    const asu = raaka || TYYPPI_PUUTTUU

    const asut = ryhmat.get(avainsana) ?? new Map<string, number>()
    asut.set(asu, (asut.get(asu) ?? 0) + 1)
    ryhmat.set(avainsana, asut)
  }

  const luvut: KohdetyypinLuku[] = []
  for (const [avainsana, asut] of ryhmat) {
    const jarjestetyt = [...asut.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], "fi")
    })
    luvut.push({
      nimi: avainsana === TYYPPI_PUUTTUU_AVAIN ? TYYPPI_PUUTTUU : jarjestetyt[0][0],
      lkm: jarjestetyt.reduce((summa, [, n]) => summa + n, 0),
      kirjoitusasut: jarjestetyt.map(([asu]) => asu),
    })
  }

  return luvut.sort((a, b) => {
    if (a.nimi === TYYPPI_PUUTTUU) return 1
    if (b.nimi === TYYPPI_PUUTTUU) return -1
    if (b.lkm !== a.lkm) return b.lkm - a.lkm
    return a.nimi.localeCompare(b.nimi, "fi")
  })
}

/*
 * Osuuko hanke valittuihin tyyppeihin. Tyhja valinta ei rajaa.
 * Vertailu on kirjainkoosta riippumaton, jotta valikon yhdistetty rivi
 * ("Koulu" 304) suodattaa myos pienella kirjoitetut.
 */
export function osuukoKohdetyyppi(
  propertyType: string | null | undefined,
  valitut: string[]
): boolean {
  if (valitut.length === 0) return true

  const raaka = (propertyType ?? "").trim()
  if (!raaka) {
    return valitut.some((v) => v === TYYPPI_PUUTTUU || v === TYYPPI_PUUTTUU_AVAIN)
  }

  const oma = avain(raaka)
  return valitut.some((v) => avain(v) === oma)
}

/*
 * Hakuvahdille tallennettava lista. Kaksi muunnosta:
 *
 *  - nimilappu laajennetaan kaikkiin kirjoitusasuihin, jotta digestin
 *    tasavertailu loytaa myos "koulu"-rivit kun valikosta valittiin
 *    "Koulu". Laajennus tehdaan KOKO aineistosta eika nakyvasta
 *    joukosta: tallennettu haku elaa pidempaan kuin yksi suodatus.
 *  - "Ei tyyppia" muuttuu tunnisteeksi, jonka digest osaa lukea.
 */
export function kohdetyyppiHakuvahdille(
  valitut: string[],
  kaikkiRivit: Rivi[]
): string[] | null {
  if (valitut.length === 0) return null

  const asutAvaimella = new Map<string, string[]>()
  for (const luku of laskeKohdetyypit(kaikkiRivit)) {
    asutAvaimella.set(avain(luku.nimi), luku.kirjoitusasut)
  }

  const ulos = new Set<string>()
  for (const valinta of valitut) {
    if (valinta === TYYPPI_PUUTTUU || valinta === TYYPPI_PUUTTUU_AVAIN) {
      ulos.add(TYYPPI_PUUTTUU_AVAIN)
      continue
    }
    const asut = asutAvaimella.get(avain(valinta))
    if (asut && asut.length > 0) for (const asu of asut) ulos.add(asu)
    else ulos.add(valinta)
  }

  return [...ulos]
}

/*
 * Hakuvahdin yhteenvetorivi sahkopostiin. Kaantaa tunnisteen takaisin
 * nimilapuksi ja luhistaa kirjoitusasut, jottei viestissa lue
 * "Kohdetyyppi: Koulu, koulu" eika pahemmin "__ei_tyyppia__".
 */
export function kohdetyypinSelite(value: unknown): string | null {
  const arvot = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : typeof value === "string" && value
      ? [value]
      : []
  if (arvot.length === 0) return null

  const nahdyt = new Set<string>()
  const nimet: string[] = []
  for (const arvo of arvot) {
    const nimi = arvo === TYYPPI_PUUTTUU_AVAIN ? TYYPPI_PUUTTUU : arvo
    const a = avain(nimi)
    if (nahdyt.has(a)) continue
    nahdyt.add(a)
    nimet.push(nimi)
  }

  return `Kohdetyyppi: ${nimet.join(", ")}`
}
