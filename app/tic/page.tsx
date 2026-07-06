import CandidateList from "./components/CandidateList"
import PotentialProjectsReviewList from "./components/PotentialProjectsReviewList"
import { getPotentialProjectsForReview } from "./services/getPotentialProjectsForReview"

export const dynamic = "force-dynamic"

export default async function TicPage() {
  const potentialProjects = await getPotentialProjectsForReview()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Työmaat Intelligence Center
        </h1>

        <p className="mt-2 text-gray-600">
          Admin-näkymä uusien hankkeiden hyväksyntään, datan laatuun ja
          discovery-putken seurantaan.
        </p>
      </section>

      <section className="mb-8">
        <PotentialProjectsReviewList projects={potentialProjects} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Vanha Candidate-lista
        </h2>

        <CandidateList />
      </section>
    </main>
  )
}