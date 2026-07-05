import Link from "next/link"
import { getDiscoveryAnalytics } from "../../services/getDiscoveryAnalytics"

export const dynamic = "force-dynamic"

function formatDate(value: string) {
  return new Date(value).toLocaleString("fi-FI")
}

function formatMs(value: number | null) {
  if (!value) return "-"
  return `${value} ms`
}

export default async function DiscoveryAnalyticsPage() {
  const analytics = await getDiscoveryAnalytics()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Discovery Analytics
      </h1>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Ajot yhteensä</div>
          <div className="mt-2 text-3xl font-bold">{analytics.totals.runs}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Dokumentteja</div>
          <div className="mt-2 text-3xl font-bold">
            {analytics.totals.documentsSaved}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">PDF:t</div>
          <div className="mt-2 text-3xl font-bold">
            {analytics.totals.pdfSaved}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Candidatet</div>
          <div className="mt-2 text-3xl font-bold">
            {analytics.totals.candidatesCreated}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Aikavälit</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Tänään</div>
            <div className="text-2xl font-bold">{analytics.byPeriod.today}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">7 päivää</div>
            <div className="text-2xl font-bold">{analytics.byPeriod.last7Days}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">30 päivää</div>
            <div className="text-2xl font-bold">{analytics.byPeriod.last30Days}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">365 päivää</div>
            <div className="text-2xl font-bold">{analytics.byPeriod.last365Days}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Viimeisimmät ajot</h2>
        </div>

        <div className="divide-y">
          {analytics.recentRuns.map((run) => (
            <div key={run.id} className="grid gap-3 p-5 md:grid-cols-7">
              <div>
                <div className="font-semibold">{run.agent_type}</div>
                <div className="text-sm text-gray-500">
                  {run.source_name ?? "-"}
                </div>
              </div>

              <div className="text-sm">{run.status}</div>

              <div className="text-sm">
                Docs {run.documents_saved ?? 0}/{run.documents_found ?? 0}
              </div>

              <div className="text-sm">
                PDF {run.pdf_saved ?? 0}/{run.pdf_found ?? 0}
              </div>

              <div className="text-sm">
                Signals {run.signals_found ?? 0}
              </div>

              <div className="text-sm">{formatMs(run.duration_ms)}</div>

              <div className="text-sm text-gray-500">
                {formatDate(run.created_at)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}