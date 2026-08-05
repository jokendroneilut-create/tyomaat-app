import { getDiscoverySources } from "./services/getDiscoverySources"
import { getSourceYield } from "./services/getSourceYield"
import SourceMonitorTable from "./components/SourceMonitorTable"
import CadenceSummary from "./components/CadenceSummary"
import {
  DISCOVERY_CRON_CONFIG,
  DISCOVERY_RUNS_PER_DAY,
} from "@/lib/agent/pipeline/cronConfig"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("fi-FI") : "-"
}

export default async function DiscoveryOperationsPage() {
  const [sources, sourceYield] = await Promise.all([
    getDiscoverySources(),
    getSourceYield(),
  ])

  const enabledCount = sources.filter((s) => s.enabled).length

  const sourcesPerRun = DISCOVERY_CRON_CONFIG.maxSourceCount

  /*
   * Lähteet joiden priority > 10 (perustaso) valitaan aina ensin
   * jokaisessa ajossa, joten ne varaavat kiinteän paikan eivätkä
   * koskaan kierrä muiden mukana. "Täysi kierros" pitää siis laskea
   * VAIN jäljelle jäävälle perustason joukolle ja jäljelle jäävillä
   * paikoilla - muuten luku näyttäisi kaikille virheellisen
   * optimistista sen jälkeen kun esim. Hilma ajetaan joka yö.
   */
  const guaranteedCount = sources.filter(
    (s) => s.enabled && s.priority > 10
  ).length
  const regularCount = enabledCount - guaranteedCount
  const regularSlotsPerRun = Math.max(1, sourcesPerRun - guaranteedCount)

  /*
   * Ajo tapahtuu 6h välein (DISCOVERY_RUNS_PER_DAY = 4), ei kerran yössä,
   * joten perustason paikkoja on käytettävissä 4× enemmän vuorokaudessa.
   * Ilman tätä täysi kierros näyttäisi 4× liian pitkältä.
   */
  const regularSlotsPerDay = regularSlotsPerRun * DISCOVERY_RUNS_PER_DAY
  const fullCycleDays = Math.ceil(regularCount / regularSlotsPerDay)
  const staleThresholdDays = Math.round(fullCycleDays * 1.5)

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Keräimien tapahtumat
      </h1>

      <p className="mt-2 text-gray-600">
        Valvo Discovery Agentien, lähteiden ja käsittelyputken toimintaa.
      </p>

      <div className="mt-10">
        <CadenceSummary
          enabledCount={enabledCount}
          sourcesPerRun={sourcesPerRun}
          runsPerDay={DISCOVERY_RUNS_PER_DAY}
          fullCycleDays={fullCycleDays}
          staleThresholdDays={staleThresholdDays}
          guaranteedCount={guaranteedCount}
        />
      </div>

      <div className="mt-6">
        <SourceMonitorTable sources={sources} staleThresholdDays={staleThresholdDays} />
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
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
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          Yritys- ja varhaislähteiden tuotto
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Montako ehdokasta kukin lähde tuotti ja mihin ne päätyivät, viimeisen
          30 päivän ajalta (project_import_events). Nämä lähteet ajetaan samassa
          putkessa muiden kanssa — yllä oleva taulukko kertoo onnistuivatko
          ajot, tämä kertoo mitä niistä tuli.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
                {sourceYield.map((source) => (
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
        </div>
      </div>
    </main>
  )
}