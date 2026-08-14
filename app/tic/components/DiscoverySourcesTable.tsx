"use client"

import { useMemo, useState } from "react"
import type { DiscoverySourceRow } from "../services/getDiscoverySources"

type Props = {
  sources: DiscoverySourceRow[]
}

type SourceStatus = "failing" | "stale" | "disabled" | "ok"
type SortKey = "status" | "name" | "run_count" | "error_count" | "last_success_at"

/*
 * VIRHEELLA ON TUOREUS.
 *
 * Aiemmin mikä tahansa kirjattu virhe teki lähteestä rikkinäisen niin
 * kauan kuin uutta onnistumista ei tullut. Kertaluontoinen katko jäi
 * siis näkyviin viikoiksi ja hukutti aidot viat alleen - mitattu
 * 14.8.2026: 13 punaista, joista yksi oli aito.
 *
 * Yli viikon vanha virhe näytetään omana tilanaan eikä lasketa
 * "ongelmiin". Sitä ei piiloteta: se jää listaan ja "Vain ongelmat"
 * -suodattimeen, koska korjaamaton vanha virhe on silti tieto.
 */
const STALE_ERROR_MS = 7 * 24 * 60 * 60 * 1000

function sourceStatus(s: DiscoverySourceRow): SourceStatus {
  if (!s.enabled) return "disabled"
  if (
    s.last_error_at &&
    (!s.last_success_at || new Date(s.last_error_at) > new Date(s.last_success_at))
  ) {
    const age = Date.now() - new Date(s.last_error_at).getTime()
    return age > STALE_ERROR_MS ? "stale" : "failing"
  }
  return "ok"
}

// Toimimattomat (rikki, vanha virhe, sitten pois) ensin.
const STATUS_RANK: Record<SourceStatus, number> = {
  failing: 0,
  stale: 1,
  disabled: 2,
  ok: 3,
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  failing: "🔴 rikki",
  stale: "🟡 vanha virhe",
  disabled: "⚪ pois",
  ok: "🟢 ok",
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "status", label: "Tila" },
  { key: "name", label: "Nimi" },
  { key: "run_count", label: "Ajot" },
  { key: "error_count", label: "Virheet" },
  { key: "last_success_at", label: "Viim. onnistuminen" },
]

export default function DiscoverySourcesTable({ sources }: Props) {
  const [runningId, setRunningId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [sortKey, setSortKey] = useState<SortKey>("status")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [onlyProblems, setOnlyProblems] = useState(false)

  const enabledCount = sources.filter((s) => s.enabled).length
  // "Ongelma" = oikeasti rikki (tuore virhe). Tarkoituksella pois kytketty
  // lähde (esim. WFS korvattu SUKKAlla) EI ole ongelma, vaikka status !== "ok",
  // eikä yli viikon vanha korjaamaton virhe (ks. sourceStatus).
  const failingCount = sources.filter((s) => sourceStatus(s) === "failing").length
  const staleCount = sources.filter((s) => sourceStatus(s) === "stale").length

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const visible = useMemo(() => {
    // Vanhaa virhettä ei piiloteta suodattimessa - se on korjaamaton, vaikkei
    // enää kiireellinen.
    const filtered = onlyProblems
      ? sources.filter((s) => {
          const status = sourceStatus(s)
          return status === "failing" || status === "stale"
        })
      : sources

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "status":
          cmp = STATUS_RANK[sourceStatus(a)] - STATUS_RANK[sourceStatus(b)]
          break
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "run_count":
          cmp = (a.run_count ?? 0) - (b.run_count ?? 0)
          break
        case "error_count":
          cmp = (a.error_count ?? 0) - (b.error_count ?? 0)
          break
        case "last_success_at":
          cmp =
            new Date(a.last_success_at ?? 0).getTime() -
            new Date(b.last_success_at ?? 0).getTime()
          break
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name)
      return sortDir === "asc" ? cmp : -cmp
    })

    return sorted
  }, [sources, sortKey, sortDir, onlyProblems])

  async function runSource(sourceId: string) {
    setRunningId(sourceId)
    setResult(null)
    try {
      const response = await fetch("/api/tic/discovery/run-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId }),
      })
      setResult(await response.json())
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Discovery Sources</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-green-700">
            käytössä {enabledCount}/{sources.length}
          </span>
          {failingCount > 0 && (
            <span className="font-semibold text-red-700">ongelmia {failingCount}</span>
          )}
          {staleCount > 0 && (
            <span className="font-semibold text-amber-700">vanhoja virheitä {staleCount}</span>
          )}
        </div>
      </div>

      {/* Sorttaus + suodatin */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm">
        <span className="text-gray-500">Järjestä:</span>
        {SORTS.map((s) => {
          const active = sortKey === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSort(s.key)}
              className={
                "rounded-lg px-2 py-1 " +
                (active ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100")
              }
            >
              {s.label}
              {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
            className="h-4 w-4"
          />
          Vain ongelmat
        </label>
      </div>

      <div className="divide-y divide-gray-200">
        {visible.map((source) => {
          const status = sourceStatus(source)
          return (
            <div
              key={source.id}
              className="grid grid-cols-1 gap-2 p-4 md:grid-cols-6 md:items-center md:gap-4"
            >
              <div className="md:col-span-2">
                <div className="font-semibold text-gray-900">{source.name}</div>
                <div className="text-sm text-gray-500">{source.id}</div>
                {(status === "failing" || status === "stale") && source.last_error_message && (
                  <div
                    className={`mt-1 text-xs ${status === "failing" ? "text-red-700" : "text-amber-700"}`}
                  >
                    {source.last_error_message}
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-700">{source.type}</div>

              <div className="text-sm font-medium text-gray-800">
                {STATUS_LABEL[status]}
              </div>

              <div className="text-sm text-gray-700">
                Ajot: {source.run_count ?? 0}
                {(source.error_count ?? 0) > 0 && (
                  <span className="text-red-700"> · virh. {source.error_count}</span>
                )}
              </div>

              <button
                onClick={() => runSource(source.id)}
                disabled={runningId === source.id}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {runningId === source.id ? "Ajetaan..." : "Aja nyt"}
              </button>
            </div>
          )
        })}
      </div>

      {result && (
        <pre className="m-4 overflow-auto rounded-xl bg-gray-100 p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
