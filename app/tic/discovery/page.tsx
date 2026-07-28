import { getDiscoverySources } from "../services/getDiscoverySources"
import { getLegacySourceHealth } from "../operations/services/getLegacySourceHealth"
import DiscoverySourcesTable from "../components/DiscoverySourcesTable"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("fi-FI") : "-"
}

export default async function DiscoveryPage() {
  const [sources, legacySources] = await Promise.all([
    getDiscoverySources(),
    getLegacySourceHealth(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Keräimien tila
        </h1>

        <p className="mt-2 text-gray-600">
          Hallitse lähteitä ja aja tiedonkeruu manuaalisesti.
        </p>
      </section>

      <DiscoverySourcesTable sources={sources} />

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          Legacy-lähteet ({legacySources.length})
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Vanha yritys-/varhaislähdeputki (lib/agent/sources.ts) ei ole
          discovery_sources-taulussa eikä sitä voi ajaa täältä yksittäin — se
          ajetaan omalla mekanismillaan (/api/agent/discover). Tila perustuu
          project_import_events-lokiin viimeisen 30 päivän ajalta.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Lähde</th>
                <th className="px-4 py-3">Viime havainto</th>
                <th className="px-4 py-3">Tapahtumia (30 pv)</th>
                <th className="px-4 py-3">Jonoon</th>
                <th className="px-4 py-3">Ohitettu</th>
              </tr>
            </thead>

            <tbody>
              {legacySources.map((source) => (
                <tr key={source.name} className="border-t">
                  <td className="px-4 py-3 font-semibold">{source.name}</td>
                  <td className="px-4 py-3">{formatDate(source.lastSeen)}</td>
                  <td className="px-4 py-3">{source.eventsLast30Days}</td>
                  <td className="px-4 py-3">{source.queuedForReview}</td>
                  <td className="px-4 py-3">{source.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
