import TodayMetrics from "./components/TodayMetrics"
import { getTodaySummary } from "./services/getTodaySummary"
import TodayRecommendedProjects from "./components/TodayRecommendedProjects"
import TodaySettingsModal from "./components/TodaySettingsModal"
import FeedbackButton from "../components/FeedbackButton"
import RoleActivationModal from "./components/RoleActivationModal"
import WelcomeInfoModal from "./components/WelcomeInfoModal"
import TeamModeToggle from "./components/TeamModeToggle"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const supabase = await createServerSupabaseClient()

const {
  data: { user },
} = await supabase.auth.getUser()

const summary = await getTodaySummary(user?.id)
  const needsRoleActivation = Boolean(user?.id) && !summary.settings.companyProfile

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {needsRoleActivation && user?.id && (
        <RoleActivationModal
          userId={user.id}
          initialSettings={summary.settings}
        />
      )}

      {user?.id && <WelcomeInfoModal suppressed={needsRoleActivation} />}

      <h1 className="text-3xl font-bold text-gray-900">Tänään</h1>

      <p className="mt-2 text-gray-600">
        Tänään-näkymä kokoaa yrityksellesi tärkeimmät rakennushankkeet
      </p>

      {/*
        * Molemmat napit samassa rivissä: mobiilissa allekkain vasempaan
        * reunaan, työpöydällä vierekkäin niin että palaute jää oikealle.
        * Erillisinä lohkoina ne asettuivat mobiilissa eri reunoihin, mikä
        * näytti siltä ettei niillä ole tekemistä keskenään.
        */}
      <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TodaySettingsModal />

        <FeedbackButton
          context="Tänään-näkymän palaute"
          className="shrink-0 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        />
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Mukauta näkymää valitsemalla alueet, hankkeen vaiheet ja tietolähteet.
      </p>

{summary.team?.inTeam && user?.id && (
  <TeamModeToggle userId={user.id} initialSettings={summary.settings} />
)}

      <TodayMetrics
        metrics={summary.metrics}
        metricProjects={summary.metricProjects}
        regions={summary.settings.regions}
      />

      <TodayRecommendedProjects
         projects={summary.recommendedProjects}
         userId={user?.id ?? null}
         feedback={summary.feedback}
         favorites={summary.favorites}
         teamMode={Boolean(
           summary.team?.inTeam && summary.settings.teamModeInToday
         )}
      />

      
    </main>
  )
}

