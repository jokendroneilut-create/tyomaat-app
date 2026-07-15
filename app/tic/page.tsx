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
        <h1 className="text-3xl font-bold text-gray-900">
          Työmaat Intelligence Center
        </h1>
      </section>

      <section className="mb-8">
        <PotentialProjectsReviewList
          projects={potentialProjects}
          totalCount={pendingReviewCount}
        />
      </section>
    </main>
  )
}