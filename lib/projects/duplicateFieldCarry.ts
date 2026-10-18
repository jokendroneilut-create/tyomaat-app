/*
 * YHDISTÄMISESSÄ PIILOTETTAVAN TIEDOT SIIRTYVÄT VOITTAJALLE.
 *
 * Johannes 18.10.2026: *"haluan että käyttäjälle on näkyvissä kaikki
 * mahdollinen tieto mitä meillä on."*
 *
 * Kaksoiskappaleen vahvistus piilotti häviäjän mutta siirsi vain
 * vaiheen, joten muut kentät jäivät kantaan näkymättömiin. Mitattu
 * 18.10.2026: **71 / 150** vahvistetusta parista oli jättänyt jotain
 * piilotetulle riville — yleisimmin tilaajan (20), koordinaatit (19)
 * ja sijainnin (12). Koordinaattien puuttuminen on näkyvin: ilman
 * niitä hanke ei piirry kartalle lainkaan.
 *
 * Vaihe oli jo tämän periaatteen soveltamista yhteen kenttään; tämä
 * yleistää sen muihin.
 */

/*
 * VAIN TYHJÄ TÄYTETÄÄN. Olemassa olevaa arvoa ei korvata eikä
 * täydennetä: se voi olla ihmisen käsin korjaama, eikä lähteestä
 * puuttuva tarkoita että käsin annettu olisi väärin.
 *
 * OSAPUOLTEN YHDISTÄMINEN KOKEILTIIN JA HYLÄTTIIN. Ensimmäinen versio
 * yhdisti osapuolikentät `mergeCompanyNames`-apurilla. Kuivaharjoitus
 * luettuna se olisi **huonontanut** kenttiä, koska apurin tunniste ei
 * normalisoi yhtiömuotoa eikä väliviivaa:
 *
 *     "Skanska Oy"           -> "Skanska Oy, Skanska"
 *     "Kreate Oy"            -> "Kreate Oy, Kreate"
 *     "Peab Oy (1509374-8)"  -> "Peab Oy (1509374-8), Peab"
 *     "GRK, NRC Group"       -> "GRK, NRC Group, GRK"
 *
 * Sama yritys olisi näkynyt asiakkaalle kahdesti eri kirjoitusasulla.
 * Kirjoitusasujen yhdistäminen on oma työnsä (docs/20).
 */
export const SIIRRETTAVAT_KENTAT = [
  "developer",
  "builder",
  "contractor",
  "earthworks_contractor",
  "structural_design",
  "hvac_design",
  "electrical_design",
  "architectural_design",
  "geotechnical_design",
  "location",
  "lat",
  "lng",
  "apartments",
  "floor_area",
  "estimated_cost",
  "start_date",
  "construction_start",
  "estimated_completion",
  "property_type",
  "additional_info",
] as const

export type SiirrettavaKentta = (typeof SIIRRETTAVAT_KENTAT)[number]

/*
 * Roska-arvot joita ei kannata siirtää näkyviin. "Muu" löytyi
 * tilaajakentästä lähdekartoituksessa (docs/20): se on kentän
 * oletusarvo, ei yritys.
 */
const ROSKA = /^(?:muu|ei tiedossa|tuntematon|n\/a|-)$/i

export function onTyhja(arvo: unknown): boolean {
  if (arvo === null || arvo === undefined) return true
  if (typeof arvo === "string") {
    const siisti = arvo.trim()
    return !siisti || siisti === "-"
  }
  return false
}

/*
 * MENNYT VALMISTUMISPÄIVÄ JÄTETÄÄN SIIRTÄMÄTTÄ.
 *
 * Mennyt päivä syöttää `autoCompleteGate`:a, joka 90 vuorokauden
 * jälkeen siirtää hankkeen Valmistuneeksi ja piilottaa sen
 * asiakkaalta (D-298, D-303). Silloin "lisää tietoa näkyviin"
 * muuttuisi piilotukseksi, eli päinvastaiseksi kuin tarkoitus.
 *
 * Mitattu takautuvassa täydennyksessä: neljä tällaista, joista yksi
 * vuodelta 2020.
 */
function menneisyydessa(arvo: unknown, nyt: string): boolean {
  const paiva = String(arvo ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(paiva) && paiva < nyt
}

/*
 * Palauttaa ne kentät jotka voittajalle kirjoitetaan. Tyhjä olio
 * tarkoittaa ettei siirrettävää ole.
 */
export function siirrettavatArvot(
  jaava: Record<string, unknown> | null | undefined,
  piilotettava: Record<string, unknown> | null | undefined,
  nyt: string = new Date().toISOString().slice(0, 10)
): Record<string, unknown> {
  if (!jaava || !piilotettava) return {}

  const paivitys: Record<string, unknown> = {}

  for (const kentta of SIIRRETTAVAT_KENTAT) {
    const oma = jaava[kentta]
    const toinen = piilotettava[kentta]

    if (!onTyhja(oma)) continue
    if (onTyhja(toinen)) continue
    if (typeof toinen === "string" && ROSKA.test(toinen.trim())) continue
    if (kentta === "estimated_completion" && menneisyydessa(toinen, nyt)) continue

    paivitys[kentta] = toinen
  }

  return paivitys
}
