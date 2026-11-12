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

import type { CostSource } from "./resolveProjectCost"

/* Sama jarjestys kuin resolveProjectCostissa; pidetaan yhtena totuutena. */
const KUSTANNUS_JARJESTYS: Record<CostSource, number> = {
  manual: 4,
  contract: 3,
  notice: 2,
  text: 1,
}

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
 * Kumman kustannus jää, säilyjän vai piilotettavan.
 *
 * Alkuperä luetaan `metadata.cost_source`ista; puuttuva tulkitaan
 * heikoimmaksi ("text") samoin kuin `resolveProjectCost`issa, koska
 * ennen 15.8.2026 kirjoitetuilla riveillä merkintää ei ole.
 *
 * Palauttaa `estimated_cost`in ja sen alkuperän vain jos piilotettavan
 * arvo on AIDOSTI parempi. Tasatilanteessa ei kirjoiteta mitään, eli
 * säilyjän luku jää — sama periaate kuin muissa kentissä.
 */
function kustannusAlkupera(rivi: Record<string, unknown>): CostSource {
  const meta = (rivi.metadata ?? {}) as Record<string, unknown>
  const arvo = meta.cost_source
  return arvo === "manual" || arvo === "contract" || arvo === "notice"
    ? arvo
    : "text"
}

function positiivinen(arvo: unknown): number | null {
  const n = Number(arvo)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parempiKustannus(
  jaava: Record<string, unknown>,
  piilotettava: Record<string, unknown>
): { estimated_cost: number; metadata?: unknown } | null {
  const toinen = positiivinen(piilotettava.estimated_cost)
  if (toinen === null) return null

  const oma = positiivinen(jaava.estimated_cost)
  if (oma === null) return { estimated_cost: toinen }

  const omaTaso = KUSTANNUS_JARJESTYS[kustannusAlkupera(jaava)]
  const toinenTaso = KUSTANNUS_JARJESTYS[kustannusAlkupera(piilotettava)]
  if (toinenTaso <= omaTaso) return null

  return { estimated_cost: toinen }
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

  /*
   * KUSTANNUS EI NOUDATA "OMA VOITTAA" -SÄÄNTÖÄ (D-407).
   *
   * Muissa kentissä säilyjän arvo voittaa, koska kaksi arvoa ovat
   * yhtä hyviä ja vanhempi on ehtinyt kerätä historiaa. Kustannus ei
   * ole sellainen: sillä on järjestys, joka on kirjoitettu jo
   * `resolveProjectCost`iin (manual > contract > notice > text).
   *
   * Sigurd Frosteruksen puiston esirakentaminen 12.11.2026: Hilman
   * kilpailutusrivi (ennakkoarvio 5,1 M€) oli täyteisempi ja jäi
   * säilyjäksi, joten piilotetun päätösrivin **toteutunut
   * urakkasumma 3,81 M€ ei päässyt sen päälle**. Yhdistäminen siis
   * säilytti vanhentuneen luvun juuri siinä vaiheessa kun oikea on
   * tiedossa — sopimus on tehty ja summa julkaistu.
   *
   * Siksi kustannus ratkaistaan samalla etusijajärjestyksellä kuin
   * tuonnissa. Heikompi alkuperä ei koskaan korvaa vahvempaa, joten
   * tekstistä poimittu arvio ei pääse sopimusarvon päälle tätäkään
   * reittiä.
   */
  const kustannus = parempiKustannus(jaava, piilotettava)
  if (kustannus) Object.assign(paivitys, kustannus)

  for (const kentta of SIIRRETTAVAT_KENTAT) {
    if (kentta === "estimated_cost") continue

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
