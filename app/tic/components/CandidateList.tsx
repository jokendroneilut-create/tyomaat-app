import CandidateCard from "./CandidateCard"
import { getCandidates } from "../services/getCandidates"

export default async function CandidateList() {
  const candidates = await getCandidates()

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Ei Candidate-hankkeita.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
        />
      ))}
    </div>
  )
}