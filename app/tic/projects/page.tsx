import PotentialProjectsReviewList from "../components/PotentialProjectsReviewList"
import { getPotentialProjectsForReview } from "../services/getPotentialProjectsForReview"

export const dynamic = "force-dynamic"

export default async function TicProjectsPage() {
  const potentialProjects = await getPotentialProjectsForReview()

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Potentiaaliset rakennushankkeet
        </h1>

        <p className="mt-2 text-gray-600">
          Discovery Agentin löytämät hankkeet, jotka odottavat hyväksyntää.
        </p>
      </section>

      <PotentialProjectsReviewList projects={potentialProjects} />
    </div>
  )
}