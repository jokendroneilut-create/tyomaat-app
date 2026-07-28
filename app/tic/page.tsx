import PotentialProjectsReviewList from "./components/PotentialProjectsReviewList"
import TicDailySummary from "./components/TicDailySummary"
import { getPotentialProjectsForReview } from "./services/getPotentialProjectsForReview"
import { getPendingReviewCount } from "./services/getPendingReviewCount"
import { getTicDailySummary } from "./services/getTicDailySummary"

export const dynamic = "force-dynamic"

export default async function TicPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const [potentialProjects, pendingReviewCount, summary] = await Promise.all([
    getPotentialProjectsForReview(page),
    getPendingReviewCount(),
    getTicDailySummary(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Työmaat Intelligence Center
        </h1>
      </section>

      <TicDailySummary {...summary} />

      <section id="review" className="mb-8">
        <PotentialProjectsReviewList
          projects={potentialProjects}
          totalCount={pendingReviewCount}
          page={page}
        />
      </section>
    </main>
  )
}