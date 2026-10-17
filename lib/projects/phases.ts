export type PhaseKey =
  | "zoning"
  | "planning"
  | "permit"
  | "tender"
  | "contract_awarded"
  | "construction"
  | "nearing_completion"
  | "completed"
  | "cancelled"

export type PhaseDefinition = {
  key: PhaseKey
  label: string
  order: number | null
  terminal?: boolean
}

/*
 * IDEOINTI POISTETTU 18.10.2026.
 *
 * Johannes: *"ideointi on pakko poistaa koska ei ole yhtaan hanketta
 * siina vaiheessa niin siina ei ole jarkea. eika muutenkaan ole
 * jarkea, suunnittelu riittaa."*
 *
 * Mitattu ennen poistoa: **0 / 6 896 hanketta** ja 0 jonorivia oli
 * Ideointi-vaiheessa. Ainoa lahde joka sita tuotti oli Fingridin
 * tilakuvio (YVA / ymparistoselvitys), ja se ohjattiin Suunnitteluun
 * samana paivana (D-303).
 *
 * Poisto tarkistettiin asiakkaiden tallennetuista valinnoista, koska
 * rikkoutunut suodatin ei laheta virhetta vaan hiljaisuutta: yksi
 * kaytossa oleva hakuvahti ja kuusi `bestSalesMoments`-listaa
 * luettelivat Ideoinnin, mutta **aina 6-9 vaiheen joukossa, ei
 * koskaan yksin** - joten poisto ei muuta yhdenkaan suodattimen
 * tulosta. Listat siivottiin erikseen.
 *
 * `Ideointi` jaa LEGACY_PHASE_MAP:iin, jotta tallennettu vanha arvo
 * normalisoituu Suunnitteluksi eika hiljaa nulliksi.
 *
 * Jarjestysnumerot alkavat nyt 1:sta: `order` on vertailuun
 * (phaseAdvances), eika aukko kentassa auta ketaan.
 */
export const CANONICAL_PHASES: PhaseDefinition[] = [
  { key: "zoning", label: "Kaavoitus", order: 1 },
  { key: "planning", label: "Suunnittelu", order: 2 },
  { key: "permit", label: "Rakennuslupa", order: 3 },
  { key: "tender", label: "Kilpailutus", order: 4 },
  { key: "contract_awarded", label: "Sopimus myönnetty", order: 5 },
  { key: "construction", label: "Rakenteilla", order: 6 },
  { key: "nearing_completion", label: "Valmistumassa", order: 7 },
  { key: "completed", label: "Valmistunut", order: 8 },
  { key: "cancelled", label: "Peruttu", order: null, terminal: true },
]

export const PHASE_LABELS = CANONICAL_PHASES.reduce(
  (acc, phase) => {
    acc[phase.key] = phase.label
    return acc
  },
  {} as Record<PhaseKey, string>
)

export const PHASE_KEYS_IN_ORDER = CANONICAL_PHASES.filter(
  (phase) => !phase.terminal
).map((phase) => phase.key)

const LEGACY_PHASE_MAP: Record<string, PhaseKey> = {
  /* Poistettu vaihe: tallennettu arvo ohjataan Suunnitteluun. */
  ideointi: "planning",
  suunnittelussa: "planning",
  "rakentaminen aloitettu": "construction",
  valmistunut: "completed",
  kilpailutus: "tender",
  "sopimus myönnetty": "contract_awarded",
}

export function normalizeLegacyPhase(
  raw: string | null | undefined
): PhaseKey | null {
  if (!raw) return null

  const value = raw.trim()
  const exact = CANONICAL_PHASES.find((phase) => phase.label === value)

  if (exact) return exact.key

  /*
   * Myös kanoninen avain kelpaa syötteeksi. Kannassa on molempia esityksiä:
   * projects.phase on otsikko ("Rakenteilla"), project_phase_history.phase on
   * avain ("construction"). Ilman tätä avaimella kutsuttu vertailu palautti
   * hiljaa nullin, eli "vaihetta ei tunnistettu" - ja esimerkiksi
   * phaseAdvances ei olisi tunnistanut peruutusta historiariviltä.
   */
  const byKey = CANONICAL_PHASES.find((phase) => phase.key === value)
  if (byKey) return byKey.key

  return LEGACY_PHASE_MAP[value.toLowerCase()] ?? null
}

export function displayPhaseLabel(raw: string | null | undefined): string {
  const key = normalizeLegacyPhase(raw)
  return key ? PHASE_LABELS[key] : raw?.trim() || "-"
}

/*
 * KESKEYTETTY KILPAILUTUS NÄKYY (D-196). D-070:n mukaan hanke pysyy
 * kilpailutusvaiheessa, koska se yleensä kilpailutetaan uudelleen - mutta
 * asiakkaalle se näytti avoimelta kilpailutukselta, johon voi vielä
 * tarjota. Lippu (`metadata.is_cancelled_procurement`) oli olemassa,
 * muttei sitä luettu missään.
 */
export function displayProjectPhase(
  raw: string | null | undefined,
  cancelledProcurement?: unknown
): string {
  const label = displayPhaseLabel(raw)
  return cancelledProcurement === true && normalizeLegacyPhase(raw) === "tender"
    ? `${label} (keskeytetty)`
    : label
}

export function phaseOrder(raw: string | null | undefined): number | null {
  const key = normalizeLegacyPhase(raw)
  if (!key) return null
  return CANONICAL_PHASES.find((phase) => phase.key === key)?.order ?? null
}

/*
 * Vaihe saa edetä muttei peruuttaa. Vanhentunut tai virheellinen ilmoitus ei
 * saa siirtää hanketta väärään suuntaan: käynnissä oleva työmaa ei palaa
 * suunnitteluun siksi että lähde julkaisi vanhan uutisen.
 *
 * Sääntö oli aiemmin vain syncApprovedProjectissa (jo hyväksytyt hankkeet),
 * kun taas agentin tuonti kirjoitti vaiheen ehdoitta. Mitattuna 4 vrk:n
 * ikkunassa 32 aidosta vaihesiirtymästä 29 oli Rakenteilla -> Suunnittelussa,
 * ja yhdessä tapauksessa agentti kumosi ihmisen hyväksynnässä asettaman
 * vaiheen. Nyt molemmat reitit käyttävät tätä samaa sääntöä.
 *
 * Tuntematon tai järjestyksetön vaihe (esim. "Peruttu", order = null) ei
 * ohita nykyistä - se on tarkoituksellista, koska emme voi tietää onko se
 * edistys.
 */
export function phaseAdvances(
  current: string | null | undefined,
  next: string | null | undefined
): boolean {
  const nextOrder = phaseOrder(next)
  if (nextOrder == null) return false

  const currentOrder = phaseOrder(current)
  return currentOrder == null || nextOrder > currentOrder
}
