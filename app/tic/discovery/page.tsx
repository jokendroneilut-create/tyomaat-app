import { getDiscoverySources } from "../services/getDiscoverySources"
import DiscoverySourcesTable from "../components/DiscoverySourcesTable"

export const dynamic = "force-dynamic"

export default async function DiscoveryPage() {
  const sources = await getDiscoverySources()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Discovery Center
        </h1>

        <p className="mt-2 text-gray-600">
          Hallitse lähteitä ja aja tiedonkeruu manuaalisesti.
        </p>
      </section>

      <DiscoverySourcesTable sources={sources} />
    </main>
  )
}