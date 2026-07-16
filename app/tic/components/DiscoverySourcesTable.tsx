"use client"

import { useState } from "react"
import type { DiscoverySourceRow } from "../services/getDiscoverySources"

type Props = {
  sources: DiscoverySourceRow[]
}

export default function DiscoverySourcesTable({ sources }: Props) {
  const [runningId, setRunningId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const enabledCount = sources.filter((source) => source.enabled).length

  async function runSource(sourceId: string) {
    setRunningId(sourceId)
    setResult(null)

    try {
      const response = await fetch("/api/tic/discovery/run-source", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceId }),
      })

      const json = await response.json()
      setResult(json)
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Discovery Sources
        </h2>
        <span className="text-sm font-semibold text-green-700">
          käytössä {enabledCount}/{sources.length}
        </span>
      </div>

      <div className="divide-y divide-gray-200">
        {sources.map((source) => (
          <div
            key={source.id}
            className="grid grid-cols-1 gap-4 p-4 md:grid-cols-6 md:items-center"
          >
            <div className="md:col-span-2">
              <div className="font-semibold text-gray-900">{source.name}</div>
              <div className="text-sm text-gray-500">{source.id}</div>
            </div>

            <div className="text-sm text-gray-700">{source.type}</div>

            <div className="text-sm text-gray-700">
              {source.enabled ? "🟢 käytössä" : "⚪ pois"}
            </div>

            <div className="text-sm text-gray-700">
              Ajot: {source.run_count ?? 0}
            </div>

            <button
              onClick={() => runSource(source.id)}
              disabled={runningId === source.id}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {runningId === source.id ? "Ajetaan..." : "Aja nyt"}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <pre className="m-4 overflow-auto rounded-xl bg-gray-100 p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}