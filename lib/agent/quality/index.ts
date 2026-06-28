export type CandidateQualityInput = {
  title: string
  summary?: string | null
  reason?: string | null
  candidate_type?: string | null
  city?: string | null
  signal_count?: number | null
  source_count?: number | null
}

export type CandidateQualityResult = {
  quality: number
  reason: string
}

type RuleResult = {
  points: number
  reason: string
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function scoreNegativeKeywords(text: string): RuleResult[] {
  const results: RuleResult[] = []

  const privateSmallTerms = [
    "omakotitalo",
    "autotalli",
    "autokatos",
    "sauna",
    "terassi",
    "piharakennus",
    "varasto",
    "laajennus",
  ]

  if (includesAny(text, privateSmallTerms)) {
    results.push({
      points: -50,
      reason: "Pieni yksityinen tai vähäarvoinen rakennuskohde",
    })
  }

  return results
}

function scorePositiveKeywords(text: string): RuleResult[] {
  const results: RuleResult[] = []

  if (includesAny(text, ["datakeskus", "data center"])) {
    results.push({ points: 45, reason: "Datakeskukseen liittyvä hanke" })
  }

  if (includesAny(text, ["koulu", "päiväkoti", "sairaala"])) {
    results.push({ points: 30, reason: "Julkinen palvelurakennus" })
  }

  if (
    includesAny(text, [
      "kerrostalo",
      "toimitila",
      "liikerakennus",
      "logistiikkakeskus",
      "teollisuushalli",
      "varastohalli",
    ])
  ) {
    results.push({ points: 30, reason: "Relevantti rakennustyyppi" })
  }

  if (includesAny(text, ["rakennuslupa", "rakentaminen", "rakennetaan"])) {
    results.push({ points: 20, reason: "Rakentamiseen liittyvä konkreettinen signaali" })
  }

  if (includesAny(text, ["tarjouspyyntö", "urakkalaskenta", "hankintailmoitus"])) {
    results.push({ points: 35, reason: "Tarjousmahdollisuus havaittu" })
  }

  return results
}

function scoreSignalStrength(input: CandidateQualityInput): RuleResult[] {
  const results: RuleResult[] = []

  if ((input.signal_count ?? 0) >= 2) {
    results.push({ points: 10, reason: "Useampi signaali samasta hankkeesta" })
  }

  if ((input.source_count ?? 0) >= 2) {
    results.push({ points: 15, reason: "Useampi lähde tukee havaintoa" })
  }

  return results
}

export function calculateCandidateQuality(
  input: CandidateQualityInput
): CandidateQualityResult {
  const text = [
    input.title,
    input.summary,
    input.reason,
    input.candidate_type,
    input.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const ruleResults = [
    ...scoreNegativeKeywords(text),
    ...scorePositiveKeywords(text),
    ...scoreSignalStrength(input),
  ]

  const rawQuality = ruleResults.reduce((sum, rule) => sum + rule.points, 0)
  const quality = Math.max(0, Math.min(100, rawQuality))

  const reason =
    ruleResults.length > 0
      ? ruleResults.map((rule) => `${rule.points > 0 ? "+" : ""}${rule.points}: ${rule.reason}`).join("; ")
      : "Ei laatupisteisiin vaikuttavia sääntöosumia"

  return {
    quality,
    reason,
  }
}