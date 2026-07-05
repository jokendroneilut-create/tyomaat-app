import Link from "next/link"
import { getDiscoveryHealth } from "../../services/getDiscoveryHealth"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("fi-FI")
}

function formatMs(value: number | null) {
  if (!value) return "-"
  return `${value} ms`
}

export default async function DiscoveryHealthPage() {
  const health = await getDiscoveryHealth()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Discovery Health
      </h1>

      <p className="mt-2 text-gray-600">
        Seuraa Discoveryn lähteitä, dokumentteja, jonoja ja viimeisimpiä ajoja.
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Sources</div>
          <div className="mt-2 text-3xl font-bold">{health.sources.total}</div>
          <div className="mt-1 text-sm text-gray-600">
            Käytössä {health.sources.enabled}, pois {health.sources.disabled}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Documents</div>
          <div className="mt-2 text-3xl font-bold">{health.documents.total}</div>
          <div className="mt-1 text-sm text-gray-600">
            Tänään {health.documents.today}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Jobs</div>
          <div className="mt-2 text-3xl font-bold">{health.jobs.pending}</div>
          <div className="mt-1 text-sm text-gray-600">
            pending · {health.jobs.error} virhettä
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Document types</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-500">HTML</div>
            <div className="text-2xl font-bold">{health.documents.html}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">PDF</div>
            <div className="text-2xl font-bold">{health.documents.pdf}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">API</div>
            <div className="text-2xl font-bold">{health.documents.api}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Queue status</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold">{health.jobs.pending}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Running</div>
            <div className="text-2xl font-bold">{health.jobs.running}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Success</div>
            <div className="text-2xl font-bold">{health.jobs.success}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Error</div>
            <div className="text-2xl font-bold">{health.jobs.error}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Recent runs</h2>
        </div>

        <div className="divide-y">
          {health.recentRuns.map((run) => (
            <div key={run.id} className="grid gap-3 p-5 md:grid-cols-6">
              <div>
                <div className="font-semibold">{run.agent_type}</div>
                <div className="text-sm text-gray-500">
                  {run.source_name ?? "-"}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Status</div>
                <div>{run.status}</div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Documents</div>
                <div>
                  {run.documents_saved ?? 0}/{run.documents_found ?? 0}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">PDF</div>
                <div>
                  {run.pdf_saved ?? 0}/{run.pdf_found ?? 0}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Duration</div>
                <div>{formatMs(run.duration_ms)}</div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Created</div>
                <div>{formatDate(run.created_at)}</div>
              </div>

              {run.error_message && (
                <div className="md:col-span-6 text-sm text-red-600">
                  {run.error_message}
                </div>
              )}
            </div>
          ))}

          {health.recentRuns.length === 0 && (
            <div className="p-5 text-gray-600">Ei ajoja vielä.</div>
          )}
        </div>
      </section>
    </main>
  )
}