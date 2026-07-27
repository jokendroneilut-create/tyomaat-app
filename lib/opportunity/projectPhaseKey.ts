import {
  CANONICAL_PHASES,
  normalizeLegacyPhase,
  type PhaseKey,
} from "@/lib/projects/phases"

/*
 * Ratkaisee hankkeen kanoniseen elinkaaren vaiheeseen (`PhaseKey`) — YKSI
 * totuuslähde pisteytystä varten (P1, §6). Korvaa sumean
 * `projectPhaseText().includes()` -logiikan.
 *
 * Prioriteetti:
 * 1. Eksplisiittinen vaihe (`project.phase` / `metadata.phase`) kanonisoituna
 *    `normalizeLegacyPhase`illa — luotetaan jos tunnistuu.
 * 2. Tekstifallback: kootaan vaihevihjeet vapaista kentistä ja palautetaan
 *    EDISTYNEIN osunut vaihe (suurin `order`). Esim. jos teksti mainitsee sekä
 *    kaavoituksen että rakennusluvan, hanke on lupavaiheessa.
 *
 * Tuntematon vaihe → null (pisteytyksessä neutraali, ei rankaise).
 */

const ORDER_BY_KEY: Record<PhaseKey, number> = CANONICAL_PHASES.reduce(
  (acc, p) => {
    acc[p.key] = p.order ?? -1
    return acc
  },
  {} as Record<PhaseKey, number>
)

/*
 * Tekstivihjeet → PhaseKey. Tarkista useampi; palautetaan edistynein osuma.
 */
const TEXT_PHASE_PATTERNS: { key: PhaseKey; patterns: RegExp[] }[] = [
  { key: "idea", patterns: [/\bidea/, /ennakko/] },
  { key: "zoning", patterns: [/kaavoitus/, /\bkaava/, /zoning/, /asemakaava/] },
  { key: "planning", patterns: [/suunnittel/] },
  { key: "permit", patterns: [/rakennuslupa/, /\bpermit/, /\blupa/] },
  {
    key: "tender",
    patterns: [/hilma/, /tarjous/, /kilpailutus/, /procurement/, /\bworks\b/],
  },
  { key: "contract_awarded", patterns: [/sopimus/, /urakoitsija valittu/] },
  {
    key: "construction",
    patterns: [/rakenteilla/, /rakentaminen aloitettu/, /\baloit/],
  },
  { key: "nearing_completion", patterns: [/valmistumassa/, /käyttöönot/] },
  { key: "completed", patterns: [/valmistunut/, /valmistui/] },
]

function phaseText(project: any): string {
  return String(
    [
      project.phase,
      project.metadata?.phase,
      project.metadata?.operation,
      project.metadata?.construction_type,
      project.metadata?.procurement_type_code,
      project.metadata?.source,
      project.metadata?.source_name,
    ]
      .filter(Boolean)
      .join(" ")
  )
    .trim()
    .toLowerCase()
}

export function projectPhaseKey(project: any): PhaseKey | null {
  // 1. Eksplisiittinen kanoninen vaihe.
  const explicit =
    normalizeLegacyPhase(project?.phase) ??
    normalizeLegacyPhase(project?.metadata?.phase)
  if (explicit) return explicit

  // 2. Tekstifallback: edistynein osuma.
  const text = phaseText(project)
  if (!text) return null

  let best: PhaseKey | null = null
  let bestOrder = -Infinity

  for (const { key, patterns } of TEXT_PHASE_PATTERNS) {
    if (patterns.some((re) => re.test(text))) {
      const order = ORDER_BY_KEY[key] ?? -1
      if (order > bestOrder) {
        bestOrder = order
        best = key
      }
    }
  }

  return best
}
