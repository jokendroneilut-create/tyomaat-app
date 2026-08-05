export type PhaseKey =
  | "idea"
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

export const CANONICAL_PHASES: PhaseDefinition[] = [
  { key: "idea", label: "Ideointi", order: 1 },
  { key: "zoning", label: "Kaavoitus", order: 2 },
  { key: "planning", label: "Suunnittelu", order: 3 },
  { key: "permit", label: "Rakennuslupa", order: 4 },
  { key: "tender", label: "Kilpailutus", order: 5 },
  { key: "contract_awarded", label: "Sopimus myönnetty", order: 6 },
  { key: "construction", label: "Rakenteilla", order: 7 },
  { key: "nearing_completion", label: "Valmistumassa", order: 8 },
  { key: "completed", label: "Valmistunut", order: 9 },
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
