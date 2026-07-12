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

  return LEGACY_PHASE_MAP[value.toLowerCase()] ?? null
}

export function displayPhaseLabel(raw: string | null | undefined): string {
  const key = normalizeLegacyPhase(raw)
  return key ? PHASE_LABELS[key] : raw?.trim() || "-"
}
