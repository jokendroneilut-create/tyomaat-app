import {
  normalizeAddress as norm,
  normalizeIdentifierValue as normalizeIdentifier,
} from "@/lib/projects/identity"

export type NormalizedProjectCandidate = {
  name?: string | null
  city?: string | null
  region?: string | null
  location?: string | null
  permitNumber?: string | null
  propertyId?: string | null
  developer?: string | null
  buildingType?: string | null
}

export type MatchableProject = {
  id: string
  name: string | null
  city: string | null
  region: string | null
  location: string | null
  phase: string | null
  completed_at?: string | null
  status?: string | null
  developer?: string | null
  property_type?: string | null

  metadata?: {
    permit_number?: string | null
    property_id?: string | null
    developer?: string | null
    building_type?: string | null
    [key: string]: unknown
  } | null
}

export type ProjectMatchReason =
  | "same_permit_number"
  | "same_property_id"
  | "same_location"
  | "same_city"
  | "same_region"
  | "exact_title"
  | "similar_title"
  | "same_developer"
  | "same_building_type"

export type ProjectMatchResult = {
  project: MatchableProject
  confidence: number
  reasons: ProjectMatchReason[]
}

const GENERIC_TITLE_WORDS = new Set([
  "hanke",
  "rakennushanke",
  "rakentaminen",
  "rakennus",
  "rakennustyöt",
  "urakka",
  "kokonaisurakka",
  "kvr",
  "työt",
  "uusi",
  "uusien",
  "peruskorjaus",
  "saneeraus",
  "korjaus",
  "laajennus",
  "kilpailutus",
  "tarjouspyyntö",
  "jälki",
  "ilmoitus",
  "jälkiilmoitus",
])


function titleWords(value: string | null | undefined) {
  return (norm(value) ?? "")
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .filter((word) => !GENERIC_TITLE_WORDS.has(word))
}

function titleSimilarity(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const firstNormalized = norm(first)
  const secondNormalized = norm(second)

  if (!firstNormalized || !secondNormalized) {
    return 0
  }

  if (firstNormalized === secondNormalized) {
    return 1
  }

  const firstWords = new Set(titleWords(first))
  const secondWords = new Set(titleWords(second))

  if (!firstWords.size || !secondWords.size) {
    return 0
  }

  let sharedCount = 0

  for (const word of firstWords) {
    if (secondWords.has(word)) {
      sharedCount += 1
    }
  }

  const unionSize = new Set([
    ...firstWords,
    ...secondWords,
  ]).size

  return unionSize > 0 ? sharedCount / unionSize : 0
}

function getProjectPermitNumber(project: MatchableProject) {
  return (
    project.metadata?.permit_number ??
    null
  )
}

function getProjectPropertyId(project: MatchableProject) {
  return (
    project.metadata?.property_id ??
    null
  )
}

function getProjectDeveloper(project: MatchableProject) {
  return (
    project.developer ??
    project.metadata?.developer ??
    null
  )
}

function getProjectBuildingType(project: MatchableProject) {
  return (
    project.property_type ??
    project.metadata?.building_type ??
    null
  )
}

export function calculateMatch(
  project: MatchableProject,
  candidate: NormalizedProjectCandidate
): ProjectMatchResult | null {
  const reasons: ProjectMatchReason[] = []
  let confidence = 0

  const candidatePermitNumber = normalizeIdentifier(
    candidate.permitNumber
  )

  const projectPermitNumber = normalizeIdentifier(
    getProjectPermitNumber(project)
  )

  if (
    candidatePermitNumber &&
    projectPermitNumber &&
    candidatePermitNumber === projectPermitNumber
  ) {
    confidence += 100
    reasons.push("same_permit_number")
  }

  const candidatePropertyId = normalizeIdentifier(
    candidate.propertyId
  )

  const projectPropertyId = normalizeIdentifier(
    getProjectPropertyId(project)
  )

  if (
    candidatePropertyId &&
    projectPropertyId &&
    candidatePropertyId === projectPropertyId
  ) {
    confidence += 100
    reasons.push("same_property_id")
  }

  const candidateName = norm(candidate.name)
  const projectName = norm(project.name)

  if (
    candidateName &&
    projectName &&
    candidateName === projectName
  ) {
    confidence += 55
    reasons.push("exact_title")
  } else {
    const similarity = titleSimilarity(
      candidate.name,
      project.name
    )

    if (similarity >= 0.75) {
      confidence += 40
      reasons.push("similar_title")
    } else if (similarity >= 0.5) {
      confidence += 25
      reasons.push("similar_title")
    } else if (similarity >= 0.3) {
      confidence += 12
      reasons.push("similar_title")
    }
  }

  const candidateLocation = norm(candidate.location)
  const projectLocation = norm(project.location)

  if (
    candidateLocation &&
    projectLocation &&
    candidateLocation === projectLocation
  ) {
    confidence += 45
    reasons.push("same_location")
  }

  const candidateCity = norm(candidate.city)
  const projectCity = norm(project.city)

  if (
    candidateCity &&
    projectCity &&
    candidateCity === projectCity
  ) {
    confidence += 20
    reasons.push("same_city")
  }

  const candidateRegion = norm(candidate.region)
  const projectRegion = norm(project.region)

  if (
    candidateRegion &&
    projectRegion &&
    candidateRegion === projectRegion
  ) {
    confidence += 8
    reasons.push("same_region")
  }

  const candidateDeveloper = norm(candidate.developer)
  const projectDeveloper = norm(
    getProjectDeveloper(project)
  )

  if (
    candidateDeveloper &&
    projectDeveloper &&
    candidateDeveloper === projectDeveloper
  ) {
    confidence += 20
    reasons.push("same_developer")
  }

  const candidateBuildingType = norm(
    candidate.buildingType
  )

  const projectBuildingType = norm(
    getProjectBuildingType(project)
  )

  if (
    candidateBuildingType &&
    projectBuildingType &&
    candidateBuildingType === projectBuildingType
  ) {
    confidence += 8
    reasons.push("same_building_type")
  }

  /*
   * Pelkkä sama maakunta ei riitä osumaksi.
   * Myöskään pelkkä sama kaupunki ei saa yhdistää hankkeita.
   */
  const hasStrongIdentifier =
    reasons.includes("same_permit_number") ||
    reasons.includes("same_property_id")

  const hasStrongLocation =
    reasons.includes("same_location")

  const hasTitleEvidence =
    reasons.includes("exact_title") ||
    reasons.includes("similar_title")

  if (
    !hasStrongIdentifier &&
    !hasStrongLocation &&
    !hasTitleEvidence
  ) {
    return null
  }

  /*
   * Jos nimi on vain heikosti samankaltainen, tarvitaan lisäksi
   * sama sijainti, kaupunki tai rakennuttaja.
   */
  if (
    reasons.includes("similar_title") &&
    confidence < 35 &&
    !reasons.includes("same_city") &&
    !reasons.includes("same_location") &&
    !reasons.includes("same_developer")
  ) {
    return null
  }

  return {
    project,
    confidence: Math.min(confidence, 100),
    reasons,
  }
}

export function findProjectMatchDetailed(
  existingProjects: MatchableProject[],
  candidate: NormalizedProjectCandidate
): ProjectMatchResult | null {
  if (!norm(candidate.name) &&
      !candidate.permitNumber &&
      !candidate.propertyId) {
    return null
  }

  const matches = existingProjects
    .map((project) =>
      calculateMatch(project, candidate)
    )
    .filter(
      (
        match
      ): match is ProjectMatchResult =>
        match !== null
    )
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence
      }

      return b.reasons.length - a.reasons.length
    })

  return matches[0] ?? null
}

/*
 * Säilytetään vanha rajapinta, jotta nykyinen
 * app/api/agent/import/route.ts toimii edelleen.
 */
export function findProjectMatch(
  existingProjects: MatchableProject[],
  candidate: NormalizedProjectCandidate
): MatchableProject | null {
  const match = findProjectMatchDetailed(
    existingProjects,
    candidate
  )

  /*
   * Vanha import-polku saa automaattisen osuman vain,
   * jos luottamus on vähintään 70.
   */
  return match && match.confidence >= 70
    ? match.project
    : null
}