import CandidateList from "./components/CandidateList"
import PotentialProjectsReviewList from "./components/PotentialProjectsReviewList"
import { getPotentialProjectsForReview } from "./services/getPotentialProjectsForReview"
import { getPendingReviewCount } from "./services/getPendingReviewCount"

export const dynamic = "force-dynamic"

export default async function TicPage() {
  const [potentialProjects, pendingReviewCount] = await Promise.all([
    getPotentialProjectsForReview(),
    getPendingReviewCount(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Työmaat Intelligence Center
            </h1>

            <p className="mt-2 text-gray-600">
              Admin-näkymä uusien hankkeiden hyväksyntään, datan laatuun ja
              discovery-putken seurantaan.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-right shadow-sm">
            <div className="text-3xl font-bold text-gray-900">
              {pendingReviewCount}
            </div>
            <div className="text-sm text-gray-500">
              hanketta odottaa hyväksyntää/hylkäystä
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <PotentialProjectsReviewList
          projects={potentialProjects}
          totalCount={pendingReviewCount}
        />
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