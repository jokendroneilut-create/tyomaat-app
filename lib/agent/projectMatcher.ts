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
  description?: string | null
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
  estimated_completion?: string | null
  additional_info?: string | null

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
  | "similar_description"
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

/*
 * Kuvaustekstien deterministinen samankaltaisuus MERKKI-TRIGRAMMEILLA (per sana,
 * ei sanarajan yli). Trigrammit kestävät suomen taivutuksen — esim.
 * "ratasmäkeen" ja "ratasmäen" jakavat suurimman osan trigrammeistaan, kun taas
 * pelkkä sanajoukko-vertailu pitäisi ne eri sanoina. Nappaa saman hankkeen eri
 * signaaleista kun kuvaukset jakavat paikannimiä, rakennuttajan ja kohdetiedot
 * — vaikka nimi/otsikko eroaisi (esim. valmistumisuutinen vs. alkuperäinen
 * kuvaus). Ei semanttinen; täysin eri sanoin kirjoitetut jäävät kiinni
 * ottamatta (siihen tarvittaisiin embeddings).
 */
function textTrigrams(text: string | null | undefined): Set<string> {
  const grams = new Set<string>()
  if (!text) return grams
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-zåäö0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  for (const word of cleaned.split(" ")) {
    if (word.length < 3) continue
    for (let i = 0; i <= word.length - 3; i++) {
      grams.add(word.slice(i, i + 3))
    }
  }
  return grams
}

function descriptionSimilarity(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const a = textTrigrams(first)
  const b = textTrigrams(second)

  // Liian lyhyet kuvaukset eivät anna luotettavaa signaalia.
  if (a.size < 10 || b.size < 10) return 0

  let sharedCount = 0
  for (const gram of a) {
    if (b.has(gram)) sharedCount += 1
  }

  const unionSize = new Set([...a, ...b]).size
  return unionSize > 0 ? sharedCount / unionSize : 0
}

function getProjectDescription(project: MatchableProject) {
  return (
    project.additional_info ??
    (project.metadata?.description as string | null | undefined) ??
    null
  )
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

  const descriptionSim = descriptionSimilarity(
    candidate.description,
    getProjectDescription(project)
  )

  if (descriptionSim >= 0.5) {
    confidence += 30
    reasons.push("similar_description")
  } else if (descriptionSim >= 0.3) {
    confidence += 18
    reasons.push("similar_description")
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

  const hasTextEvidence =
    reasons.includes("exact_title") ||
    reasons.includes("similar_title") ||
    reasons.includes("similar_description")

  if (
    !hasStrongIdentifier &&
    !hasStrongLocation &&
    !hasTextEvidence
  ) {
    return null
  }

  /*
   * Jos todiste on vain heikosti samankaltainen nimi/kuvaus, tarvitaan
   * lisäksi sama sijainti, kaupunki tai rakennuttaja — muuten pelkkä
   * geneerinen tekstiosuma yhdistäisi eri hankkeita.
   */
  const onlyWeakText =
    (reasons.includes("similar_title") ||
      reasons.includes("similar_description")) &&
    !reasons.includes("exact_title")

  if (
    onlyWeakText &&
    confidence < 45 &&
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