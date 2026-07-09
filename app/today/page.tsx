import TodayMetrics from "./components/TodayMetrics"
import { getTodaySummary } from "./services/getTodaySummary"
import TodayRecommendedProjects from "./components/TodayRecommendedProjects"
import TodaySettingsModal from "./components/TodaySettingsModal"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const summary = await getTodaySummary()
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Tänään
      </h1>

      <p className="mt-2 text-gray-600">
        Päivän tärkeimmät rakennushankkeet ja tapahtumat.
      </p>

<div className="mt-4">
  <TodaySettingsModal />
</div>

      <TodayMetrics metrics={summary.metrics} />

      <TodayRecommendedProjects
         projects={summary.recommendedProjects}
      />

      
    </main>
  )
}

