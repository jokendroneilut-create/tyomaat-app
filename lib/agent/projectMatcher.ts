export type NormalizedProjectCandidate = {
  name?: string | null
  city?: string | null
  region?: string | null
  location?: string | null
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
}

function norm(s: string | null | undefined) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function findProjectMatch(
  existingProjects: MatchableProject[],
  candidate: NormalizedProjectCandidate
): MatchableProject | null {
  const candidateName = norm(candidate.name)
  const candidateCity = norm(candidate.city)
  const candidateRegion = norm(candidate.region)
  const candidateLocation = norm(candidate.location)

  if (!candidateName) return null

  let match =
  candidateCity
    ? existingProjects.find((p) => {
        return norm(p.name) === candidateName && norm(p.city) === candidateCity
      })
    : undefined
  if (match) return match

  match =
  candidateRegion
    ? existingProjects.find((p) => {
        return norm(p.name) === candidateName && norm(p.region) === candidateRegion
      })
    : undefined
  if (match) return match

  match =
  candidateLocation
    ? existingProjects.find((p) => {
        return norm(p.name) === candidateName && norm(p.location) === candidateLocation
      })
    : undefined
  if (match) return match

  if (candidateName.length >= 12 && !candidateCity && !candidateRegion) {
  match = existingProjects.find((p) => norm(p.name) === candidateName)
  if (match) return match
}

  return null
}