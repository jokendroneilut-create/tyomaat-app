import Link from "next/link"
import { getRecentPipelineRuns } from "../../services/getRecentPipelineRuns"
import PipelineRunsTable from "./PipelineRunsTable"
import {
  DISCOVERY_MAX_DURATION_SECONDS,
  DISCOVERY_PLATFORM_HARD_LIMIT_SECONDS,
} from "@/lib/agent/pipeline/cronConfig"

export const dynamic = "force-dynamic"

export default async function PipelineRunsPage() {
  const runs = await getRecentPipelineRuns(30)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Ajot</h1>

      <p className="mt-2 text-gray-600">
        Koko yöllisen discovery-putken (kaikki vaiheet yhdessä
        cron-kutsussa) viimeisimmät suoritukset ja niiden kesto.
      </p>

      <div className="mt-8">
        <PipelineRunsTable
          runs={runs}
          maxDurationSeconds={DISCOVERY_MAX_DURATION_SECONDS}
          platformHardLimitSeconds={DISCOVERY_PLATFORM_HARD_LIMIT_SECONDS}
        />
      </div>
    </main>
  )
}
