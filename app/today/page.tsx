import TodayMetrics from "./components/TodayMetrics"
import { getTodaySummary } from "./services/getTodaySummary"
import TodayRecommendedProjects from "./components/TodayRecommendedProjects"
import TodaySettingsModal from "./components/TodaySettingsModal"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const supabase = await createServerSupabaseClient()

const {
  data: { user },
} = await supabase.auth.getUser()

const summary = await getTodaySummary(user?.id)
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center gap-3">
  <h1 className="text-3xl font-bold text-gray-900">
    Tänään
  </h1>

  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
    BETA
  </span>
</div>

      <p className="mt-2 text-gray-600">
        Päivän tärkeimmät rakennushankkeet ja tapahtumat.
      </p>

      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

    <div>
      <p className="font-semibold text-gray-900">
        Tänään-näkymä on beta-vaiheessa
      </p>

      <p className="mt-1 text-sm text-gray-700">
        Tänään kokoaa yrityksellesi tärkeimmät rakennushankkeet yhteen näkymään.
        Kehitämme ominaisuutta jatkuvasti käyttäjäpalautteen perusteella.
      </p>
    </div>

    <a
  href="mailto:palautteet@tyomaat.fi?subject=Tänään-näkymän palaute"
  className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
>
  Anna palautetta
</a>

  </div>
</div>

<div className="mt-4">
  <TodaySettingsModal />
</div>

<p className="mt-3 text-sm text-gray-500">
  Mukauta näkymää valitsemalla alueet, hankkeen vaiheet ja tietolähteet.
</p>

      <TodayMetrics metrics={summary.metrics} />

      <TodayRecommendedProjects
         projects={summary.recommendedProjects}
      />

      
    </main>
  )
}

