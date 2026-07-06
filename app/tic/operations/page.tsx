import { getDiscoverySources } from "./services/getDiscoverySources"
import SourceMonitorTable from "./components/SourceMonitorTable"

export const dynamic = "force-dynamic"

export default async function DiscoveryOperationsPage() {
  const sources = await getDiscoverySources()

  const enabledCount = sources.filter((s) => s.enabled).length
  const warningCount = sources.filter(
    (s) => s.last_error_message === null && s.error_count > 0
  ).length
  const errorCount = sources.filter(
    (s) => s.last_error_message !== null
  ).length

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Discovery Operations
      </h1>

      <p className="mt-2 text-gray-600">
        Valvo Discovery Agentien, lähteiden ja käsittelyputken toimintaa.
      </p>

      <div className="mt-10">
      <SourceMonitorTable sources={sources} />
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">Lähde</th>
              <th className="px-4 py-3">Collector</th>
              <th className="px-4 py-3">Parser</th>
              <th className="px-4 py-3">Viime ajo</th>
              <th className="px-4 py-3">Ajot</th>
              <th className="px-4 py-3">Virheet</th>
            </tr>
          </thead>

          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-semibold">{source.name}</div>
                  <div className="text-xs text-gray-500">
                    {source.category}
                  </div>
                </td>

                <td className="px-4 py-3">{source.collector}</td>

                <td className="px-4 py-3">{source.parser}</td>

                <td className="px-4 py-3">
                  {source.last_run_at
                    ? new Date(source.last_run_at).toLocaleString("fi-FI")
                    : "-"}
                </td>

                <td className="px-4 py-3">{source.run_count}</td>

                <td className="px-4 py-3">{source.error_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function MetricCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}